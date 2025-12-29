APK_SOURCE = SMUTHUB/app/build/outputs/apk/debug/app-debug.apk
APK_DEST = SMUTHUB.apk

.PHONY: update-apk

update-apk:
	@if [ -f $(APK_SOURCE) ]; then \
		echo "Found debug APK. Preparing to update..."; \
		rm -f $(APK_DEST); \
		cp $(APK_SOURCE) $(APK_DEST); \
		echo "SMUTHUB.apk updated successfully."; \
	else \
		echo "Error: Source APK not found at $(APK_SOURCE)"; \
		exit 1; \
	fi
