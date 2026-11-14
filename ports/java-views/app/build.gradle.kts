plugins { id("com.android.application") }

// Plain Java + android.view / android.graphics only: no AndroidX, no Kotlin runtime.
android {
    namespace = "com.flappydash.java"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.flappydash.java"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// The game's sounds (assets/sfx in the repo root) become res/raw/*.wav, so every port plays the same files.
val copySfx = tasks.register<Copy>("copySfx") {
    from(rootProject.file("../../assets/sfx")) { include("*.wav"); exclude("click.wav", "best.wav") }
    into(layout.buildDirectory.dir("generated/sfx/raw"))
}
android.sourceSets.getByName("main").res.srcDir(layout.buildDirectory.dir("generated/sfx"))
tasks.named("preBuild") { dependsOn(copySfx) }
