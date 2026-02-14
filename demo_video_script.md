# OtpAuthApp Demo Video Script

## 1️⃣ INTRO (≈10 seconds)
Hi everyone! Today I’ll be walking you through my Android assignment, the OtpAuthApp. The goal of this project was to build a passwordless authentication flow using Email and OTP. It’s built entirely with Jetpack Compose and Kotlin, and handles all the logic—like OTP generation, validation, and session tracking—locally without needing a backend.

---

## 2️⃣ EMAIL LOGIN SCREEN EXPLANATION
### UI FLOW
We start with the Login Screen. It’s a clean interface where the user enters their email address. Once they hit "Send OTP," the app validates the email format and triggers the OTP generation. Since there’s no real backend, the app just moves to the next state internally.

### CODE EXPLANATION
This screen is implemented in LoginScreen.kt. I used @Composable functions for the UI and rememberSaveable to keep the email input intact even if the screen rotates.

The logic follows State Hoisting. The UI is "dumb"—it doesn't decide what happens next. It just captures the email and sends an event to the AuthViewModel.

```kotlin
// LoginScreen.kt snippet
var email by rememberSaveable { mutableStateOf("") }

Button(
    onClick = { onEmailSubmitted(email) },
    enabled = email.isNotBlank() && Patterns.EMAIL_ADDRESS.matcher(email).matches()
) {
    Text("Send OTP")
}
```

---

## 3️⃣ OTP SCREEN EXPLANATION
### UI FLOW
After entering the email, we land on the OtpScreen. Here, the user sees a 6-digit OTP input field, a "Verify" button, and a "Resend" option.

### OTP RULES
I’ve implemented a few strict rules here to make it realistic:
* The OTP is exactly 6 digits.
* It expires in 60 seconds.
* The user has a maximum of 3 attempts to get it right.
* If they click Resend, the old OTP is invalidated immediately.

### CODE EXPLANATION
Behind the scenes, we have OtpScreen.kt, OtpManager.kt, and AuthState.kt.

In OtpManager, I store OTP data in a Map<String, OtpData>. This allows the app to track specific OTPs for different emails. I use timestamps to check for expiry and an integer to track failed attempts.

I also used Sealed Classes for OtpValidationResult, which makes handling different outcomes like "expired" or "wrong code" very clean in the ViewModel.

```kotlin
// OtpManager.kt logic snippet
fun validateOtp(email: String, input: String): OtpValidationResult {
    val data = otpMap[email] ?: return OtpValidationResult.NotFound
    if (System.currentTimeMillis() - data.timestampMillis > 60000) {
        return OtpValidationResult.ExpiredOtp
    }
    // ... logic for matches and attempt counts
}
```

---

## 4️⃣ SESSION SCREEN EXPLANATION
### UI FLOW
Once verified, the user enters the SessionScreen. This screen shows exactly when the session started and a live timer showing the duration in mm:ss format.

### TIMER REQUIREMENTS
One key requirement was that the timer must survive recompositions. To achieve this, I kept the timer logic inside the AuthViewModel. It starts as soon as the session begins and stops when the user logs out. The UI just observes the current duration string.

### CODE EXPLANATION
In AuthViewModel.kt, I use viewModelScope and a coroutine with a while(isActive) loop to update the timer every second. Because it's in the ViewModel, it doesn't reset if the user rotates their phone.

```kotlin
// AuthViewModel.kt timer logic
private fun startSessionTimer(startTime: Long) {
    timerJob = viewModelScope.launch {
        while (isActive) {
            delay(1000)
            val elapsed = calculateElapsed(startTime)
            val currentState = _uiState.value
            if (currentState is AuthState.Session) {
                _uiState.value = currentState.copy(elapsedDisplay = elapsed)
            }
        }
    }
}
```

---

## 5️⃣ ARCHITECTURE & STATE MANAGEMENT
The app follows a strict One-Way Data Flow. The AuthViewModel is the single source of truth. It holds the uiState using a sealed class called AuthState. This class represents every possible view: EmailInput, OtpInput, Session, and even specific Error states. This separation ensures that business logic stays out of the UI files.

---

## 6️⃣ EXTERNAL SDK (MANDATORY)
For an external SDK, I chose **Timber** for logging. It’s lightweight and much better than standard `Log.d` calls. 

### CODE EXPLANATION
I initialized it in my [OtpAuthApplication.kt](file:///c:/Users/lokesh%20kumar%20rongali/AndroidStudioProjects/OtpAuthApp/app/src/main/java/com/example/otpauthapp/OtpAuthApplication.kt) class using `Timber.plant`. This ensures logging is only active during debug builds. Then, I wrapped the actual logging calls in an [AnalyticsLogger.kt](file:///c:/Users/lokesh%20kumar%20rongali/AndroidStudioProjects/OtpAuthApp/app/src/main/java/com/example/otpauthapp/analytics/AnalyticsLogger.kt) class. This abstracts the logging logic away from the ViewModel, making it easier to maintain.

The app logs critical events like when an OTP is generated, validation results, and logout.

```kotlin
// Timber initialization in OtpAuthApplication.kt
if (BuildConfig.DEBUG) {
    Timber.plant(Timber.DebugTree())
}

// AnalyticsLogger.kt snippet
fun logOtpValidationFailure(email: String, reason: String) {
    Timber.w("OTP failed for: $email. Reason: $reason")
}
```

---

## 7️⃣ SETUP & RUN INSTRUCTIONS
To run the app, simply open the project in Android Studio and let Gradle sync finish. Once that's done, select an emulator or a physical device and hit the "Run" button. There’s no extra setup or API keys required since all the logic is local.

And that's the OtpAuthApp! Thanks for watching.
