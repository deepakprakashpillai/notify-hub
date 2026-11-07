import React, { useState } from 'react';
import { Key, Copy, Check, AlertTriangle, X } from 'lucide-react';
import styles from './ApiKeyModal.module.css';

interface ApiKeyModalProps {
  apiKey: string;
  environmentName: string;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ apiKey, environmentName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy API key', err);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <Key size={20} color="var(--accent)" />
            API Key Generated ({environmentName})
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className={styles.warningBox}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Save this key securely!</strong>
            <p>This API key will not be shown again. Make sure to copy and store it safely in your environment variables.</p>
          </div>
        </div>

        <div className={styles.keyContainer}>
          <span className={styles.keyText}>{apiKey}</span>
          <button
            className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ''}`}
            onClick={handleCopy}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
