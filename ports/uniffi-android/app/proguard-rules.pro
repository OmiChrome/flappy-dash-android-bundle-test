# JNA + UniFFI use reflection; keep them
-keep class com.sun.jna.** { *; }
-keep class uniffi.** { *; }
-dontwarn java.awt.**
