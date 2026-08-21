#!/usr/bin/env python3
"""Browser-level acceptance verification for Letter Carry."""

from __future__ import annotations

import contextlib
import http.server
from pathlib import Path
import socketserver
import threading

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        pass


@contextlib.contextmanager
def static_server():
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}/?chain=0"
        finally:
            server.shutdown()
            thread.join(timeout=2)


def game_state(page):
    return page.evaluate("window.__LETTER_CARRY__.getState()")


def enter_solution(page, auto_submit: bool = False):
    solution = game_state(page)["solution"]
    if auto_submit:
        for letter in solution:
            page.keyboard.press(letter)
        return
    for letter in solution:
        page.locator(f'.letter-tile[data-letter="{letter}"]:not(.is-selected)').click()


def run() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    errors: list[str] = []
    with static_server() as url, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1100}, device_scale_factor=1)
        page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
        page.goto(url, wait_until="networkidle")
        page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)

        expect(page.locator(".word-row")).to_have_count(6)
        assert [page.locator(f'.word-row[data-row="{row}"] .answer-slot').count() for row in range(6)] == [3, 4, 5, 6, 7, 8]
        expect(page.locator(".letter-tile")).to_have_count(6)

        first = game_state(page)["solution"]
        for letter in reversed(first):
            page.locator(f'.letter-tile[data-letter="{letter}"]').click()
        assert game_state(page)["round"] == 0
        expect(page.locator("#game-status")).to_contain_text("isn’t the hidden word")
        expect(page.locator("#attempt-history")).to_be_visible()
        expect(page.locator(".attempt-item")).to_have_count(1)
        expect(page.locator(".attempt-word")).to_contain_text(first[::-1])

        used_letter = first[0]
        page.keyboard.press(used_letter)
        expect(page.locator('.word-row.is-active .answer-slot.is-filled')).to_have_count(1)
        expect(page.locator(f'.letter-tile.is-selected[data-letter="{used_letter}"]')).to_have_count(1)
        expect(page.locator("#game-status")).to_contain_text("building a new one")

        page.locator("#clear-button").click()
        for letter in reversed(first):
            page.locator(f'.letter-tile[data-letter="{letter}"]').click()
        expect(page.locator("#game-status")).to_contain_text("isn’t the hidden word")
        distractor = next(tile["letter"] for tile in game_state(page)["tiles"] if not tile["carry"] and tile["letter"] not in first)
        page.keyboard.press(distractor)
        expect(page.locator('.word-row.is-active .answer-slot.is-filled')).to_have_count(1)
        expect(page.locator("#game-status")).to_contain_text("building a new one")

        page.locator("#clear-button").click()
        enter_solution(page, auto_submit=True)
        page.wait_for_function("window.__LETTER_CARRY__.getState().round === 1")
        expect(page.locator('.letter-tile[data-kind="carry"]')).to_have_count(3)
        expect(page.locator('.letter-tile[data-kind="new"]')).to_have_count(3)
        expect(page.locator(".letter-tile")).to_have_count(6)

        page.locator("#restart-button").click()
        assert game_state(page)["round"] == 0
        assert game_state(page)["hintsUsed"] == 0
        assert game_state(page)["attempts"] == 0
        assert game_state(page)["solved"] == []

        page.locator("#hint-button").click()
        assert sum(tile["eliminated"] for tile in game_state(page)["tiles"]) == 1
        page.locator("#hint-button").click()
        assert game_state(page)["locked"] == [0]
        page.locator("#hint-button").click()
        assert game_state(page)["locked"] == [0, 1]
        assert game_state(page)["hintsUsed"] == 3
        expect(page.locator("#hint-button")).to_be_disabled()

        page.locator("#restart-button").click()
        for expected_round in range(6):
            enter_solution(page)
            if expected_round < 5:
                page.wait_for_function(f"window.__LETTER_CARRY__.getState().round === {expected_round + 1}")
        expect(page.locator("#win-dialog")).to_have_attribute("open", "")
        assert game_state(page)["solved"] == game_state(page)["chain"]
        page.locator("#play-again-button").click()
        assert game_state(page)["round"] == 0 and game_state(page)["hintsUsed"] == 0

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile.on("console", lambda message: errors.append(f"mobile-console:{message.type}:{message.text}") if message.type == "error" else None)
        mobile.on("pageerror", lambda error: errors.append(f"mobile-pageerror:{error}"))
        mobile.goto(url, wait_until="networkidle")
        overflow = mobile.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, f"mobile horizontal overflow: {overflow}px"
        expect(mobile.locator(".letter-tile")).to_have_count(6)
        mobile.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
        browser.close()

    assert not errors, "Browser errors: " + " | ".join(errors)
    print("PASS: Letter Carry browser acceptance checks completed")
    print(f"desktop_screenshot={ARTIFACTS / 'desktop.png'}")
    print(f"mobile_screenshot={ARTIFACTS / 'mobile.png'}")


if __name__ == "__main__":
    run()
