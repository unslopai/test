import pathlib
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="C:/Program Files/Google/Chrome/Application/chrome.exe", headless=True)
    p = b.new_page(viewport={"width": 1400, "height": 1000}, device_scale_factor=1)
    p.goto((here / "compose.html").as_uri()); p.evaluate("document.fonts.ready"); p.wait_for_timeout(800)
    for sec in p.locator("section.frame").all():
        name = sec.get_attribute("id")
        sec.screenshot(path=str(here / f"{name}.png")); print(name)
    b.close()
