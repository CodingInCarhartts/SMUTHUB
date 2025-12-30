plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.example.smuthub"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.smuthub"
        minSdk = 24
        targetSdk = 34
        versionCode = 40
        versionName = "1.0.45"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)

    // Lynx Core
    implementation(libs.lynx.core)
    implementation(libs.lynx.jssdk)
    implementation(libs.lynx.trace)
    implementation(libs.lynx.primjs)

    // Lynx Services
    implementation(libs.lynx.service.image)
    implementation(libs.lynx.service.log)
    implementation(libs.lynx.service.http)

    // XElement (Rich UI)
    implementation(libs.lynx.xelement)
    implementation(libs.lynx.xelement.input)

    // Fresco for Images
    implementation(libs.fresco)
    implementation(libs.fresco.animated.gif)
    implementation(libs.fresco.animated.webp)
    implementation(libs.fresco.webpsupport)
    implementation(libs.fresco.animated.base)

    // OkHttp for Network
    implementation(libs.okhttp)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}


kotlin {
    jvmToolchain(17)
}
