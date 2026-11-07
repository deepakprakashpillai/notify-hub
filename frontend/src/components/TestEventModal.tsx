import React, { useState } from 'react';
import modalStyles from './ApiKeyModal.module.css';
import styles from './TestEventModal.module.css';
import { X, Send, Play, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/client';

interface TestEventModalProps {
  workflowKey: string;
  environmentName: string;
  sampleVariables: Record<string, any>;
  onClose: () => void;
}

export default function TestEventModal({
  workflowKey,
  environmentName,
  sampleVariables,
  onClose,
}: TestEventModalProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [userId, setUserId] = useState<string>('usr_student_101');
  const [userEmail, setUserEmail] = useState<string>('student@example.com');
  const [priority, setPriority] = useState<'high' | 'default' | 'low'>('default');
  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify(sampleVariables, null, 2)
  );

  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [responseResult, setResponseResult] = useState<{
    status: number;
    data: any;
    ok: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTestTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setErrorMsg('Please enter an Environment API Key (generate one on Applications page)');
      return;
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(payloadJson);
    } catch (err: any) {
      setErrorMsg(`Invalid JSON payload: ${err.message}`);
      return;
    }

    try {
      setIsTriggering(true);
      setErrorMsg(null);
      setResponseResult(null);

      const requestBody = {
        event_id: `test_evt_${Date.now()}`,
        workflow: workflowKey,
        recipients: [
          {
            user_id: userId.trim(),
            email: userEmail.trim(),
            data: parsedData,
          },
        ],
        data: parsedData,
        priority,
      };

      const res = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      setResponseResult({
        status: res.status,
        data,
        ok: res.ok,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch test event');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={`${modalStyles.modal} ${styles.testModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={styles.titleRow}>
            <Play size={20} color="var(--green)" />
            <div>
              <h2 className={modalStyles.title}>Event Trigger Simulator</h2>
              <span className={styles.subTitle}>
                Test workflow <code>{workflowKey}</code> ({environmentName})
              </span>
            </div>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleTestTrigger} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Environment API Key *
              </label>
              <input
                type="password"
                className={styles.input}
                placeholder="Paste X-API-Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Priority Override</label>
              <select
                className={styles.select}
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="high">High</option>
                <option value="default">Default</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Test Recipient User ID</label>
              <input
                type="text"
                className={styles.input}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Test Recipient Email</label>
              <input
                type="email"
                className={styles.input}
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Payload Data JSON (Jinja Variables)</label>
            <textarea
              className={styles.jsonArea}
              rows={5}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
            />
          </div>

          {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

          <div className={styles.actionRow}>
            <button
              type="submit"
              className={styles.triggerBtn}
              disabled={isTriggering || !apiKey.trim()}
            >
              {isTriggering ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Dispatching...
                </>
              ) : (
                <>
                  <Send size={15} /> Trigger Test Event
                </>
              )}
            </button>
          </div>
        </form>

        {responseResult && (
          <div className={styles.responseContainer}>
            <div className={styles.responseHeader}>
              <span className={styles.responseStatus}>
                {responseResult.ok ? (
                  <CheckCircle2 size={16} color="#34d399" />
                ) : (
                  <XCircle size={16} color="#f87171" />
                )}
                HTTP Status: {responseResult.status} ({responseResult.ok ? 'ACCEPTED' : 'ERROR'})
              </span>
              {responseResult.data?.job_id && (
                <Link to="/monitoring" className={styles.viewJobLink} onClick={onClose}>
                  View in Monitoring <ArrowRight size={12} />
                </Link>
              )}
            </div>

            <pre className={styles.responsePre}>
              {JSON.stringify(responseResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
