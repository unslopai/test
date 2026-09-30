"""Real GitHub screenshots (logged out, dark scheme, DSF 2) of unslopai/test for PH gallery image 1."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
HIDE = """
.js-targetable-elem:target, .timeline-comment-group:target, [id^=discussion_r]:target {box-shadow:none!important;outline:none!important}
.js-targetable-elem:target .timeline-comment, :target .review-comment {box-shadow:none!important}
.js-cookie-consent-banner, cookie-consent-banner, .signup-prompt-bg, .js-notice, .flash-full {display:none!important}
"""


def open_page(browser, url, width):
    ctx = browser.new_context(viewport={"width": width, "height": 1000}, device_scale_factor=2, color_scheme="dark")
    page = ctx.new_page()
    page.goto(url, wait_until="load", timeout=90000)
    page.wait_for_timeout(6000)
    page.add_style_tag(content=HIDE)
    page.mouse.move(0, 0)
    page.wait_for_timeout(500)
    return ctx, page


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, headless=True)
    ctx, page = open_page(browser, "https://github.com/unslopai/test/pull/20/files", 940)
    page.screenshot(path=f"{OUT}/pr20-files-comment.png", clip={"x": 24, "y": 440, "width": 892, "height": 374})
    ctx.close()
    ctx, page = open_page(browser, "https://github.com/unslopai/test/runs/109778712708", 1000)
    page.screenshot(path=f"{OUT}/pr20-check-run.png", clip={"x": 0, "y": 175, "width": 1000, "height": 320})
    ctx.close()
    ctx, page = open_page(browser, "https://github.com/unslopai/test/pull/14#discussion_r4031632637", 1100)
    thread = page.locator("review-thread-collapsible", has=page.locator("#discussion_r4031632637"))
    thread.screenshot(path=f"{OUT}/pr14-hal002-thread.png", timeout=90000)
    ctx.close()
    ctx, page = open_page(browser, "https://github.com/unslopai/test/runs/98190837186", 1000)
    page.screenshot(path=f"{OUT}/pr14-check-run-pane.png", clip={"x": 338, "y": 245, "width": 662, "height": 250})
    ctx.close()
    browser.close()
