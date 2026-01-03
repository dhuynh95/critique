#!/usr/bin/env python3
import json
import sys
import os
import pync

data = json.load(sys.stdin)
message = data.get('message', 'Notification')
notif_type = data.get('notification_type', '')
cwd = data.get('cwd', '')
session_id = data.get('session_id', '')

# Get project name from cwd
project_name = os.path.basename(cwd) if cwd else 'Unknown'

# Try to get human-readable session display from history
session_display = None
history_path = os.path.expanduser('~/.claude/history.jsonl')
if session_id and os.path.exists(history_path):
    try:
        with open(history_path, 'r') as f:
            for line in f:
                entry = json.loads(line)
                if entry.get('sessionId') == session_id:
                    session_display = entry.get('display', '')[:40]
    except:
        pass

titles = {
    'permission_prompt': '🔐 Permission Needed',
    'idle_prompt': '💬 Awaiting Input',
    'auth_success': '✅ Auth Success',
    'elicitation_dialog': '📝 Input Required',
}
base_title = titles.get(notif_type, 'Claude Code')

# Build title with project and optional session context
if session_display:
    title = f"{base_title} [{project_name}]"
    message = f"{session_display}...\n{message}"
else:
    title = f"{base_title} [{project_name}]"

pync.notify(message, title=title, sound='default')
