#!/usr/bin/env bash
set -euo pipefail
# Interactive release script (Digit) — bump patch/minor/major with 1/2/3

REG="${REG:-harbor.karlshamnenergi.se}"
NS="${NS:-digit}"

APP_NAME="infra_graph"
REPO="$REG/$NS/$APP_NAME"

# --- sanity: VERSION file ---
if [[ ! -f VERSION ]]; then
  echo "❌ VERSION file missing. Create one like: echo 0.0.1 > VERSION"
  exit 1
fi

CUR_VERSION="$(tr -d ' \n' < VERSION)"
if [[ ! "$CUR_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "❌ VERSION must be MAJOR.MINOR.PATCH (e.g. 0.0.1). Found: '$CUR_VERSION'"
  exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"

PATCH_NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"
MINOR_NEXT="${MAJOR}.$((MINOR + 1)).0"
MAJOR_NEXT="$((MAJOR + 1)).0.0"

echo ""
echo "Current image:"
echo "  App: $REPO"
echo "Current version: $CUR_VERSION"
echo ""
echo "Choose bump target:"
echo "  1) Patch  → $PATCH_NEXT"
echo "  2) Minor  → $MINOR_NEXT"
echo "  3) Major  → $MAJOR_NEXT"
read -rp "Select [1/2/3, default 1]: " CHOICE
CHOICE="${CHOICE:-1}"

case "$CHOICE" in
  1) NEW_VERSION="$PATCH_NEXT" ;;
  2) NEW_VERSION="$MINOR_NEXT" ;;
  3) NEW_VERSION="$MAJOR_NEXT" ;;
  *) echo "❌ Invalid choice '$CHOICE' (use 1/2/3)"; exit 1 ;;
esac

echo "$NEW_VERSION" > VERSION
echo "🔢 Version set: $CUR_VERSION → $NEW_VERSION"
echo ""

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

SEMVER_PATCH="$NEW_VERSION"
SEMVER_MINOR="$(cut -d. -f1-2 <<<"$NEW_VERSION")"
SEMVER_MAJOR="$(cut -d. -f1 <<<"$NEW_VERSION")"

################################
# Build + tag: INFRA_GRAPH
################################
echo "🔨 Building $REPO:$SEMVER_PATCH (git $GIT_SHA)"
docker build \
  -f docker/Dockerfile \
  --build-arg VERSION="$SEMVER_PATCH" \
  --build-arg REVISION="$GIT_SHA" \
  --build-arg CREATED="$CREATED" \
  -t "$REPO:$SEMVER_PATCH" \
  -t "$REPO:$SEMVER_MINOR" \
  -t "$REPO:$SEMVER_MAJOR" \
  -t "$REPO:latest" \
  .

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "🚫 DRY_RUN=1 set – skipping docker push."
  exit 0
fi

echo "📦 Pushing to Harbor:"
for tag in "$SEMVER_PATCH" "$SEMVER_MINOR" "$SEMVER_MAJOR" latest; do
  echo " → $REPO:$tag"
  docker push "$REPO:$tag"
done

echo "✅ Done! Pushed:"
echo "  - $REPO:$SEMVER_PATCH ($SEMVER_MINOR, $SEMVER_MAJOR, latest)"
