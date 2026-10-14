"""Iteration 22 — Frontend-only wallet topup e2e test (uses Clerk ticket to bypass bot protection)."""
import asyncio
import os
import subprocess
import tempfile

from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
BANK_PM_ID = "075910cf-572b-48d7-96b7-fd47fc1f12fe"
CARD_PM_ID = "4ef42eb9-23a3-47bd-bfc7-72b244ef5326"


def mint_ticket(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_ticket.py", uid], text=True).strip()


async def inject_clerk(page, ticket):
    """Wait for Clerk SDK, then sign in via ticket strategy."""
    await page.wait_for_function("() => window.Clerk && window.Clerk.loaded", timeout=20000)
    result = await page.evaluate(
        """async (ticket) => {
            try {
                const si = await window.Clerk.client.signIn.create({strategy: "ticket", ticket});
                if (si.status !== "complete") return {ok: false, status: si.status};
                await window.Clerk.setActive({session: si.createdSessionId});
                return {ok: true, uid: window.Clerk.user?.id};
            } catch (e) { return {ok: false, err: String(e)}; }
        }""",
        ticket,
    )
    print(f"[clerk inject] {result}")
    return result


async def main():
    results = {"steps": [], "pass": 0, "fail": 0}

    def ok(step, cond, msg=""):
        if cond:
            results["pass"] += 1
            print(f"PASS: {step} {msg}")
            results["steps"].append({"step": step, "ok": True, "msg": msg})
        else:
            results["fail"] += 1
            print(f"FAIL: {step} {msg}")
            results["steps"].append({"step": step, "ok": False, "msg": msg})

    ticket = mint_ticket(MEMBER_UID)
    print(f"ticket OK ({len(ticket)} chars)")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1920, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        )
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"[pageerror] {e}"))

        try:
            # 1. Load home + sign in via ticket
            await page.goto(BASE, wait_until="domcontentloaded")
            r = await inject_clerk(page, ticket)
            ok("clerk-signin", r.get("ok") is True and r.get("uid") == MEMBER_UID, str(r))

            # 2. Navigate to wallet topup
            await page.goto(f"{BASE}/account/wallet/topup", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="wallet-topup-page"]', timeout=15000)
            ok("wallet-topup-page-loads", True)

            # 3. Payment method grid loads with 5 cards
            await page.wait_for_selector('[data-testid="pm-grid"]', timeout=10000)
            await page.wait_for_timeout(500)
            cards = await page.locator('[data-testid^="pm-card-"]').count()
            ok("pm-grid-5-cards", cards == 5, f"got {cards}")

            # 4. presets + custom amount
            for v in [50, 100, 200, 500, 1000, 2000]:
                vis = await page.locator(f'[data-testid="topup-preset-{v}"]').is_visible()
                if not vis:
                    ok(f"preset-{v}", False)
                    break
            else:
                ok("all-presets-visible", True)

            await page.click('[data-testid="topup-preset-200"]')
            await page.wait_for_timeout(200)
            amt = await page.locator('[data-testid="topup-amount"]').inner_text()
            ok("preset-200-amount", "200" in amt, amt)

            # 5. category tabs filter
            await page.click('[data-testid="pm-cat-bank"]')
            await page.wait_for_timeout(300)
            bank_cards = await page.locator('[data-testid^="pm-card-"]').count()
            ok("pm-cat-bank-only-1", bank_cards == 1, f"got {bank_cards}")

            await page.click('[data-testid="pm-cat-card"]')
            await page.wait_for_timeout(300)
            card_cards = await page.locator('[data-testid^="pm-card-"]').count()
            ok("pm-cat-card-only-1", card_cards == 1, f"got {card_cards}")

            await page.click('[data-testid="pm-cat-all"]')
            await page.wait_for_timeout(300)
            all_cards = await page.locator('[data-testid^="pm-card-"]').count()
            ok("pm-cat-all-returns", all_cards == 5, f"got {all_cards}")

            # 6. select bank card and verify pm-description
            await page.click(f'[data-testid="pm-card-{BANK_PM_ID}"]')
            await page.wait_for_timeout(200)
            desc_vis = await page.locator('[data-testid="pm-description"]').is_visible()
            ok("pm-description-visible", desc_vis)

            # 7. custom amount 30 → toast error min 50
            await page.fill('[data-testid="topup-custom"]', "30")
            await page.wait_for_timeout(200)
            await page.click('[data-testid="topup-submit"]')
            await page.wait_for_timeout(1500)
            # should NOT navigate
            url_after = page.url
            ok("min-50-no-navigate", "/topup" in url_after and "/topups?" not in url_after, url_after)

            # 8. Bank-transfer flow with preset-100
            await page.fill('[data-testid="topup-custom"]', "")
            await page.click('[data-testid="topup-preset-100"]')
            await page.wait_for_timeout(200)
            await page.click(f'[data-testid="pm-card-{BANK_PM_ID}"]')
            await page.wait_for_timeout(200)
            await page.click('[data-testid="topup-submit"]')
            # should navigate to /account/wallet/topups?topup=<id>
            await page.wait_for_url("**/account/wallet/topups?topup=**", timeout=10000)
            await page.wait_for_selector('[data-testid="wallet-topups-page"]', timeout=10000)
            topup_url = page.url
            topup_id = topup_url.split("topup=")[-1]
            ok("bank-topup-created", bool(topup_id), topup_id)

            # row + bank-panel
            await page.wait_for_selector(f'[data-testid="topup-row-{topup_id}"]', timeout=10000)
            await page.wait_for_selector(f'[data-testid="bank-panel-{topup_id}"]', timeout=10000)
            ref = await page.locator(f'[data-testid="topup-ref-{topup_id}"]').inner_text()
            ok("bank-panel-visible+ref", bool(ref), f"ref={ref}")

            # 9. Fill proof form
            # create tiny PNG
            png_bytes = bytes.fromhex(
                "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082"
            )
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            tmp.write(png_bytes)
            tmp.close()

            await page.fill(f'[data-testid="proof-payer-{topup_id}"]', "測試付款人")
            await page.fill(f'[data-testid="proof-note-{topup_id}"]', "E2E")
            await page.set_input_files(f'[data-testid="proof-file-{topup_id}"]', tmp.name)
            await page.wait_for_timeout(300)
            await page.click(f'[data-testid="proof-submit-{topup_id}"]')
            await page.wait_for_timeout(2500)
            status_text = await page.locator(f'[data-testid="topup-status-{topup_id}"]').inner_text()
            ok("proof-submit-reviewing", "审核" in status_text or "審核" in status_text or "reviewing" in status_text.lower(), status_text)

            # 10. Stripe flow — select card (preset 50)
            await page.goto(f"{BASE}/account/wallet/topup", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="wallet-topup-page"]', timeout=10000)
            await page.click('[data-testid="topup-preset-50"]')
            await page.wait_for_timeout(200)
            await page.click(f'[data-testid="pm-card-{CARD_PM_ID}"]')
            await page.wait_for_timeout(200)
            # Expect navigation to stripe
            async with page.expect_navigation(timeout=15000) as nav_info:
                await page.click('[data-testid="topup-submit"]')
            await page.wait_for_timeout(500)
            final_url = page.url
            ok("stripe-redirect", final_url.startswith("https://checkout.stripe.com"), final_url)

            # 11. Back to /account/wallet/topups should see pending stripe
            await page.goto(f"{BASE}/account/wallet/topups", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="wallet-topups-page"]', timeout=10000)
            await page.wait_for_timeout(1500)
            # look for any pending stripe row (topup-reopen-* or topup-check-*)
            reopen_count = await page.locator('[data-testid^="topup-reopen-"], [data-testid^="topup-check-"]').count()
            ok("stripe-pending-row", reopen_count >= 1, f"reopen/check count={reopen_count}")

        except Exception as e:
            print(f"EXCEPTION: {e}")
            try:
                await page.screenshot(path="/tmp/wallet_fail.png", quality=40, full_page=False)
            except Exception:
                pass
            results["fail"] += 1
            results["steps"].append({"step": "exception", "ok": False, "msg": str(e)})
        finally:
            # Save topup_id for cleanup/admin flow
            try:
                print(f"CREATED_TOPUP_ID={topup_id}")
            except Exception:
                pass
            await browser.close()

    print(f"\n===== SUMMARY: {results['pass']} pass / {results['fail']} fail =====")
    return results


if __name__ == "__main__":
    asyncio.run(main())
