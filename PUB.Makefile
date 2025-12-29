.PHONY: build publish

build:
	pnpm build

publish: build
	@echo "Publishing new version..."
	node publish.js
	@echo "Publication complete. Make sure to commit and push your changes to host the bundle!"
