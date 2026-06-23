#!/bin/sh
set -eu

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PATH_FILE="$PACKAGE_DIR/storageData-path.txt"
MANIFEST_FILE="$PACKAGE_DIR/manifest.json"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ -f "$PATH_FILE" ] || fail "缺少 storageData-path.txt。"
[ -f "$MANIFEST_FILE" ] || fail "缺少 manifest.json。"

TARGET_DIR=$(grep -v '^[[:space:]]*#' "$PATH_FILE" | sed '/^[[:space:]]*$/d' | head -n 1)
[ -n "$TARGET_DIR" ] || fail "请先编辑 storageData-path.txt，填写 storageData 文件夹路径。"
[ -d "$TARGET_DIR" ] || fail "目标 storageData 文件夹不存在：$TARGET_DIR"

json_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p; s/.*\"$1\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p" "$MANIFEST_FILE" | head -n 1
}

OPENED_REVISION=$(json_field openedRevision)
OPENED_HASH=$(json_field openedHash)
CANDIDATE_FILE=$(json_field candidateFileName)
REVISION_FILE=$(json_field revisionFileName)
CONFLICT_FILE=$(json_field conflictFileName)
RETENTION=$(json_field revisionRetention)

[ -f "$PACKAGE_DIR/$CANDIDATE_FILE" ] || fail "缺少候选 current 文件：$CANDIDATE_FILE"
[ -f "$PACKAGE_DIR/revisions/$REVISION_FILE" ] || fail "缺少 revision 文件：$REVISION_FILE"

mkdir -p "$TARGET_DIR/revisions" "$TARGET_DIR/conflicts"

if [ "$OPENED_REVISION" = "0" ]; then
  if [ -f "$TARGET_DIR/current.json" ]; then
    cp "$PACKAGE_DIR/$CANDIDATE_FILE" "$TARGET_DIR/conflicts/$CONFLICT_FILE"
    fail "目标已存在 current.json，已写入 conflicts/$CONFLICT_FILE，未覆盖。"
  fi
else
  [ -f "$TARGET_DIR/current.json" ] || fail "目标缺少 current.json，无法校验基线。"
  CURRENT_REVISION=$(sed -n 's/.*"revision"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$TARGET_DIR/current.json" | head -n 1)
  CURRENT_HASH=$(sed -n 's/.*"contentHash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TARGET_DIR/current.json" | head -n 1)
  if [ "$CURRENT_REVISION" != "$OPENED_REVISION" ] || [ "$CURRENT_HASH" != "$OPENED_HASH" ]; then
    cp "$PACKAGE_DIR/$CANDIDATE_FILE" "$TARGET_DIR/conflicts/$CONFLICT_FILE"
    fail "目标 current.json 已变化，已写入 conflicts/$CONFLICT_FILE，未覆盖。"
  fi
fi

cp "$PACKAGE_DIR/revisions/$REVISION_FILE" "$TARGET_DIR/revisions/$REVISION_FILE"
cp "$PACKAGE_DIR/$CANDIDATE_FILE" "$TARGET_DIR/current.json"

find "$TARGET_DIR/revisions" -maxdepth 1 -type f -name 'storage-data-rev-[0-9][0-9][0-9][0-9][0-9][0-9].json' \
  | sort -r \
  | awk -v keep="$RETENTION" 'NR > keep { print }' \
  | while IFS= read -r old_revision; do rm -f "$old_revision"; done

printf '%s\n' "Snow Cues 保存包已应用。"
