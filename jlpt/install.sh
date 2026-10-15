#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  JLPT N4 — Install as Desktop App
#  Pop!_OS / Ubuntu
#  Installs to ~/.local/share/jlpt_n4/ and registers as a real app
# ═══════════════════════════════════════════════════════════════════

set -e

APP_NAME="JLPT N4 Practice"
APP_ID="jlpt-n4"
INSTALL_DIR="$HOME/.local/share/jlpt_n4"
DESKTOP_APPS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
DESKTOP_SHORTCUT="$HOME/Desktop/$APP_ID.desktop"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  🗾  JLPT N4 Practice — Installer${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

# ── 1. Check python3 ─────────────────────────────────────────────
echo -n "  Checking python3... "
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}NOT FOUND${NC}"
    echo "  Install with: sudo apt install python3"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# ── 2. Check / install tkinter ───────────────────────────────────
echo -n "  Checking tkinter... "
if ! python3 -c "import tkinter" &>/dev/null; then
    echo -e "${YELLOW}installing...${NC}"
    sudo apt install -y python3-tk
else
    echo -e "${GREEN}OK${NC}"
fi

# ── 3. Create install dir ────────────────────────────────────────
echo -n "  Creating app directory... "
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_APPS_DIR"
mkdir -p "$ICON_DIR"
echo -e "${GREEN}OK${NC}"

# ── 4. Copy app file ─────────────────────────────────────────────
echo -n "  Copying app files... "
cp "$SCRIPT_DIR/jlpt_n4_app.py" "$INSTALL_DIR/jlpt_n4_app.py"
chmod +x "$INSTALL_DIR/jlpt_n4_app.py"
echo -e "${GREEN}OK${NC}"

# ── 5. Generate icon ─────────────────────────────────────────────
echo -n "  Generating icon... "
if [[ -f "$SCRIPT_DIR/jlpt_n4_icon.png" ]]; then
    cp "$SCRIPT_DIR/jlpt_n4_icon.png" "$ICON_DIR/$APP_ID.png"
    # Also put a copy in install dir as fallback
    cp "$SCRIPT_DIR/jlpt_n4_icon.png" "$INSTALL_DIR/$APP_ID.png"
    echo -e "${GREEN}OK${NC}"
else
    # Generate icon on the fly
    python3 "$SCRIPT_DIR/make_icon.py" "$ICON_DIR/$APP_ID.png" 2>/dev/null || \
    python3 - <<'PYEOF' "$ICON_DIR/$APP_ID.png"
import sys, struct, zlib
out = sys.argv[1]
W = H = 64
def chunk(name, data):
    c = struct.pack('>I', len(data)) + name + data
    return c + struct.pack('>I', zlib.crc32(name+data) & 0xffffffff)
rows = []
for y in range(H):
    row = b'\x00'
    for x in range(W):
        if 4<=x<60 and 4<=y<60:
            if 20<=y<38: row += bytes([232,68,90,255])
            elif 42<=y<56: row += bytes([240,180,41,255])
            else: row += bytes([28,27,40,255])
        else:
            row += bytes([18,17,26,255])
    rows.append(row)
png = (b'\x89PNG\r\n\x1a\n'
    + chunk(b'IHDR', struct.pack('>IIBBBBB',W,H,8,6,0,0,0))
    + chunk(b'IDAT', zlib.compress(b''.join(rows)))
    + chunk(b'IEND', b''))
open(out,'wb').write(png)
PYEOF
    cp "$ICON_DIR/$APP_ID.png" "$INSTALL_DIR/$APP_ID.png" 2>/dev/null || true
    echo -e "${GREEN}OK${NC}"
fi

ICON_PATH="$ICON_DIR/$APP_ID.png"
# Fallback to install dir icon if hicolor dir failed
[[ -f "$ICON_PATH" ]] || ICON_PATH="$INSTALL_DIR/$APP_ID.png"

# ── 6. Write .desktop entry (app library) ────────────────────────
echo -n "  Registering app in launcher... "
cat > "$DESKTOP_APPS_DIR/$APP_ID.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=JLPT N4 Practice
GenericName=Japanese Study
Comment=Daily JLPT N4 mock test and statistics tracker
Exec=python3 $INSTALL_DIR/jlpt_n4_app.py
Icon=$ICON_PATH
Terminal=false
Categories=Education;Languages;
Keywords=japanese;JLPT;N4;study;language;
StartupNotify=true
StartupWMClass=JLPTApp
DESKTOP
chmod +x "$DESKTOP_APPS_DIR/$APP_ID.desktop"
echo -e "${GREEN}OK${NC}"

# ── 7. Desktop shortcut ───────────────────────────────────────────
echo -n "  Creating desktop shortcut... "
if [[ -d "$HOME/Desktop" ]]; then
    cp "$DESKTOP_APPS_DIR/$APP_ID.desktop" "$DESKTOP_SHORTCUT"
    chmod +x "$DESKTOP_SHORTCUT"
    # Trust the desktop file (GNOME/Pop!_OS requires this)
    gio set "$DESKTOP_SHORTCUT" metadata::trusted true 2>/dev/null || \
    dbus-launch gio set "$DESKTOP_SHORTCUT" metadata::trusted true 2>/dev/null || true
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}SKIPPED (no Desktop folder found)${NC}"
fi

# ── 8. Clear old statistics ───────────────────────────────────────
echo -n "  Clearing statistics for fresh start... "
rm -f "$HOME/.jlpt_n4/statistics.json" \
       "$HOME/.jlpt_n4/sessions.json"   2>/dev/null || true
echo -e "${GREEN}OK${NC}"

# ── 9. Refresh app database ───────────────────────────────────────
echo -n "  Refreshing app database... "
update-desktop-database "$DESKTOP_APPS_DIR" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
echo -e "${GREEN}OK${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  Installation complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  • App is now in your app library (search 'JLPT')"
echo "  • Desktop shortcut created at: $DESKTOP_SHORTCUT"
echo "  • Statistics have been cleared (fresh start)"
echo ""
echo "  To launch from terminal any time:"
echo "  python3 $INSTALL_DIR/jlpt_n4_app.py"
echo ""
echo -e "  ${YELLOW}Tip: right-click the desktop icon → Allow Launching${NC}"
echo -e "  ${YELLOW}(Pop!_OS may ask this the first time)${NC}"
echo ""
