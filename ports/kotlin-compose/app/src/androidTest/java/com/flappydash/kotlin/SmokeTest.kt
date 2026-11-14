package com.flappydash.kotlin

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Smoke test: the app starts, the start screen renders, and a tap starts the game.
 * The game loop never stops, so Compose is never "idle": the test drives the frame clock
 * by hand (autoAdvance = false) instead of waiting for idle.
 */
@RunWith(AndroidJUnit4::class)
class SmokeTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Before
    fun manualClock() {
        rule.mainClock.autoAdvance = false
        rule.mainClock.advanceTimeBy(500)
    }

    @Test
    fun startScreenRenders() {
        rule.onNodeWithText("Flappy").assertIsDisplayed()
        rule.onNodeWithText("⏱ Benchmark (60 s)").assertIsDisplayed()
    }

    @Test
    fun tapStartsTheGame() {
        rule.onRoot().performTouchInput { click(center) }
        rule.mainClock.advanceTimeBy(1000)
        // the title disappears once the game is playing
        rule.onAllNodes(hasText("Flappy")).assertCountEquals(0)
    }
}
