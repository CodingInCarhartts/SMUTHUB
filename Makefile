.PHONY: publish help

help:
	@echo "SMUTHUB Release Management"
	@echo "  make publish   - Run the interactive release script (update version, Supabase, Git)"

publish:
	npm run publish
