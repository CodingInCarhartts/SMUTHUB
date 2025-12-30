.PHONY: publish-native

publish-native:
	@echo "🦁 Starting Native Update Process..."
	node publish-native.js "$(MSG)"

publish-ota:
	@echo "🚀 Starting OTA Update Process..."
	node publish-ota.js "$(MSG)"
