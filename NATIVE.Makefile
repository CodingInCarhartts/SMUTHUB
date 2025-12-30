.PHONY: publish-native

publish-native:
	@echo "🦁 Starting Native Update Process..."
	node publish-native.js "$(MSG)"
