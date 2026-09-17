import sys
import json
import subprocess

def extract_trajectory(zstd_path):
    proc = subprocess.Popen(['zstd', '-dc', zstd_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = proc.communicate()
    lines = stdout.decode('utf-8', errors='replace').strip().split('\n')

    trajectory = []
    current_step = None

    for line in lines:
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except Exception:
            continue

        etype = event.get('type')

        if etype == 'user/message':
            content = event.get('data', {}).get('content', [])
            text = '\n'.join(p.get('text', '') for p in content if p.get('type') == 'text')
            trajectory.append({
                'type': 'user_prompt',
                'text': text
            })

        elif etype == 'step/start':
            current_step = {
                'step': event.get('data', {}).get('step', len(trajectory)),
                'reasoning': '',
                'tool_calls': [],
                'tool_results': [],
                'assistant_text': '',
                'usage': None
            }

        elif etype == 'assistant/message':
            data = event.get('data', {})
            usage = data.get('usage')
            msg = data.get('message', {})
            content = msg.get('content', []) if isinstance(msg, dict) else data.get('content', [])

            for part in content:
                ptype = part.get('type')
                if ptype == 'text':
                    text = part.get('text', '')
                    if '<think>' in text and '</think>' in text:
                        start = text.find('<think>') + 7
                        end = text.find('</think>')
                        current_step['reasoning'] = text[start:end].strip()
                        current_step['assistant_text'] = (text[:start-7] + text[end+8:]).strip()
                    else:
                        current_step['assistant_text'] = text
                elif ptype == 'reasoning':
                    current_step['reasoning'] = part.get('text', '')

            if usage:
                current_step['usage'] = usage

        elif etype == 'tool/call':
            tdata = event.get('data', {})
            current_step['tool_calls'].append({
                'name': tdata.get('name'),
                'args': tdata.get('arguments')
            })

        elif etype == 'tool/result':
            rdata = event.get('data', {})
            msg = rdata.get('message', {})
            content = msg.get('content', [])
            res_texts = []
            for c in content:
                sub = c.get('content', [])
                for s in sub:
                    if s.get('type') == 'text':
                        res_texts.append(s.get('text', ''))
            full_res = '\n'.join(res_texts)
            current_step['tool_results'].append({
                'length': len(full_res),
                'preview': full_res[:500] if full_res else str(rdata)[:500]
            })

        elif etype == 'step/end':
            if current_step:
                trajectory.append({'type': 'step', **current_step})
                current_step = None

    return trajectory

if __name__ == '__main__':
    path = sys.argv[1]
    traj = extract_trajectory(path)
    print(json.dumps(traj, indent=2))
