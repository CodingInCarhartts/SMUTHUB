.PHONY: build publish

build:
	pnpm build

publish: build
	@echo "Publishing new version..."
	node publish.js
	@echo "Publication complete. Make sure to commit and push your changes to host the bundle!"
	# User console command `turbo` is an alias for an ai powered commit message generator
	# Use it to generate a commit message and push your changes to github
	turbo
