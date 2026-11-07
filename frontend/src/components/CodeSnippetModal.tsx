import { useState } from 'react';
import modalStyles from './ApiKeyModal.module.css';
import styles from './CodeSnippetModal.module.css';
import { X, Copy, Check, Code2, Terminal, FileCode } from 'lucide-react';
import { API_BASE_URL } from '../api/client';

interface CodeSnippetModalProps {
  workflowKey: string;
  environmentName: string;
  samplePayload: Record<string, any>;
  onClose: () => void;
}

type Lang = 'curl' | 'python' | 'node';

export default function CodeSnippetModal({
  workflowKey,
  environmentName,
  samplePayload,
  onClose,
}: CodeSnippetModalProps) {
  const [activeLang, setActiveLang] = useState<Lang>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  const payloadJson = JSON.stringify(
    {
      event_id: `evt_${Date.now()}`,
      workflow: workflowKey,
      recipients: [
        {
          user_id: 'usr_9981',
          email: 'student@example.com',
          data: samplePayload,
        },
      ],
      data: samplePayload,
      priority: 'default',
    },
    null,
    2
  );

  const getCode = (): string => {
    switch (activeLang) {
      case 'curl':
        return `curl -X POST "${API_BASE_URL}/events" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_ENVIRONMENT_API_KEY" \\
  -d '${payloadJson}'`;

      case 'python':
        return `import requests

url = "${API_BASE_URL}/events"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_ENVIRONMENT_API_KEY"
}
payload = ${JSON.stringify(JSON.parse(payloadJson), null, 4)}

response = requests.post(url, headers=headers, json=payload)
print(response.status_code, response.json())`;

      case 'node':
        return `import fetch from 'node-fetch';

const url = '${API_BASE_URL}/events';
const payload = ${payloadJson};

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_ENVIRONMENT_API_KEY'
  },
  body: JSON.stringify(payload)
});

const data = await response.json();
console.log(data);`;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={`${modalStyles.modal} ${styles.snippetModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={styles.modalTitleRow}>
            <Code2 size={20} color="var(--accent)" />
            <div>
              <h2 className={modalStyles.title}>API Integration Snippet</h2>
              <span className={styles.subTitle}>
                Workflow: <code>{workflowKey}</code> ({environmentName})
              </span>
            </div>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.langTabs}>
          <button
            className={`${styles.langTab} ${activeLang === 'curl' ? styles.langTabActive : ''}`}
            onClick={() => setActiveLang('curl')}
          >
            <Terminal size={14} /> cURL
          </button>
          <button
            className={`${styles.langTab} ${activeLang === 'python' ? styles.langTabActive : ''}`}
            onClick={() => setActiveLang('python')}
          >
            <FileCode size={14} /> Python
          </button>
          <button
            className={`${styles.langTab} ${activeLang === 'node' ? styles.langTabActive : ''}`}
            onClick={() => setActiveLang('node')}
          >
            <Code2 size={14} /> Node.js / TS
          </button>
        </div>

        <div className={styles.codeBlockContainer}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? (
              <>
                <Check size={14} color="#34d399" /> Copied!
              </>
            ) : (
              <>
                <Copy size={14} /> Copy Code
              </>
            )}
          </button>
          <pre className={styles.codePre}>{getCode()}</pre>
        </div>

        <div className={styles.hintFooter}>
          <span>💡 Replace <code>YOUR_ENVIRONMENT_API_KEY</code> with your environment API key generated on the Applications page.</span>
        </div>
      </div>
    </div>
  );
}
