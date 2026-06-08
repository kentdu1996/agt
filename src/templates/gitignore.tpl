# ===== AgentGuard recommended .gitignore =====

# --- Secrets / environment ---
.env
.env.*
!.env.example
*.key
*.pem
*.p12
*.pfx
*.cer
*.crt
secrets.json
credentials.json
service-account*.json

# --- Node ---
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.pnpm-store/
.npm/
.yarn/
.eslintcache
*.tgz

# --- Build output ---
dist/
build/
out/
.next/
.nuxt/
.svelte-kit/
.turbo/
.cache/
.parcel-cache/
coverage/
*.tsbuildinfo

# --- Python ---
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
ENV/
.python-version
*.egg-info/
.eggs/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.tox/
.coverage
htmlcov/

# --- Go ---
*.exe
*.exe~
*.dll
*.test
*.out
vendor/

# --- Rust ---
target/
Cargo.lock

# --- Java / JVM ---
*.class
*.jar
.gradle/
target/

# --- IDE / Editor ---
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.swp
*.swo
*~
.project
.classpath
.settings/

# --- OS ---
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
desktop.ini

# --- Logs / temp ---
*.log
logs/
tmp/
temp/
*.tmp
*.bak
*.orig

# --- Databases ---
*.sqlite
*.sqlite3
*.db

# --- AgentGuard internal ---
.agentguard/checkpoints/
