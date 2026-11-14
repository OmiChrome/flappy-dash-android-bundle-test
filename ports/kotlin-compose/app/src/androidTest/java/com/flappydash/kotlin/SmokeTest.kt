package com.flappydash.kotlin

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Smoke test: the app starts, the start screen renders, and a tap starts the game without crashing. */
@RunWith(AndroidJUnit4::class)
class SmokeTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun startScreenRenders() {
        rule.onNodeWithText("Flappy").assertIsDisplayed()
        rule.onNodeWithText("⏱ Benchmark (60 s)").assertIsDisplayed()
    }

    @Test
    fun tapStartsTheGame() {
        rule.onRoot().performTouchInput { click(center) }
        rule.mainClock.advanceTimeBy(500)
        // the title is gone once playing; the score "0" or higher is shown instead
        rule.waitUntil(3000) { rule.onAllNodesWithTextSafe("Flappy") == 0 }
    }
}

private fun androidx.compose.ui.test.junit4.AndroidComposeTestRule<*, *>.onAllNodesWithTextSafe(text: String): Int =
    onAllNodes(androidx.compose.ui.test.hasText(text)).fetchSemanticsNodes().size
