'use client';

import { useEffect, useMemo, useState } from 'react';

interface SendResponse {
  ok: boolean;
  data?: {
    id: string;
    payloadBase64: string;
    byteLength: number;
    channel: string;
    encoding: string;
    createdAt: string;
    queue: { queued: boolean; queueDepth: number } | null;
  };
  error?: string;
  details?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  direction: 'in' | 'out';
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  status: 'online' | 'offline';
  unread: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface AuthProfile {
  phone: string;
  nickname: string;
}

type Locale = 'en' | 'sq';

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    loginTitle: 'Sign in to NodeSMS',
    loginSubtitle: 'Use your phone number and nickname to start messaging.',
    phoneLabel: 'Phone number',
    nicknameLabel: 'Nickname',
    continue: 'Continue to chat',
    messengerTitle: 'NodeSMS Messenger',
    messengerSubtitle: 'Global-ready chat over real HTTP + real LoRaWAN services',
    install: 'Install App',
    logout: 'Logout',
    contacts: 'Contacts / Mesh Peers',
    recipient: 'Recipient number',
    channelHttp: 'HTTP',
    channelLora: 'LoRaWAN',
    cbor: 'CBOR',
    msgpack: 'MessagePack',
    typeMessage: 'Type a message...',
    sending: 'Sending...',
    send: 'Send',
    channelHttpLive: 'Real HTTP gateway live',
    channelLoraLive: 'Real LoRaWAN gateway live',
    debugTitle: 'Transport Debug (last response)',
    welcome: 'Welcome to NodeSMS. Ready for global delivery 🌍',
    sync: 'Sync',
    online: 'Online',
    offline: 'Offline',
  },
  sq: {
    loginTitle: 'Hyr në NodeSMS',
    loginSubtitle: 'Përdor numrin e telefonit dhe nickname për të nisur bisedën.',
    phoneLabel: 'Numri i telefonit',
    nicknameLabel: 'Nickname',
    continue: 'Vazhdo në chat',
    messengerTitle: 'NodeSMS Messenger',
    messengerSubtitle: 'Chat global me shërbime reale HTTP + LoRaWAN',
    install: 'Instalo App',
    logout: 'Dil',
    contacts: 'Kontaktet / Mesh Peers',
    recipient: 'Numri i marrësit',
    channelHttp: 'HTTP',
    channelLora: 'LoRaWAN',
    cbor: 'CBOR',
    msgpack: 'MessagePack',
    typeMessage: 'Shkruaj mesazhin...',
    sending: 'Duke dërguar...',
    send: 'Dërgo',
    channelHttpLive: 'Gateway HTTP real aktiv',
    channelLoraLive: 'Gateway LoRaWAN real aktiv',
    debugTitle: 'Debug transporti (përgjigja e fundit)',
    welcome: 'Mirë se erdhe te NodeSMS. Gati për dërgesë globale 🌍',
    sync: 'Sinkron',
    online: 'Online',
    offline: 'Offline',
  },
};

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  const sanitized = trimmed.replace(/[^\d+]/g, '');
  if (sanitized.startsWith('+')) {
    return `+${sanitized.slice(1).replace(/\D/g, '')}`;
  }
  return sanitized.replace(/\D/g, '');
}

function isPhoneValid(input: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(input);
}

export default function NodeSmsPage() {
  const [to, setTo] = useState('+355692540306');
  const [phoneInput, setPhoneInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const [locale, setLocale] = useState<Locale>('en');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'http' | 'lorawan'>('lorawan');
  const [encoding, setEncoding] = useState<'cbor' | 'msgpack'>('cbor');
  const [loading, setLoading] = useState(false);
  const [sendResult, setSendResult] = useState<SendResponse | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      text: MESSAGES.en.welcome,
      direction: 'in',
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      status: 'delivered',
    },
  ]);
  const [contacts] = useState<Contact[]>([
    { id: 'peer-001', name: 'Ledi11', phone: '+355692540306', status: 'online', unread: 0 },
    { id: 'peer-002', name: 'US Relay', phone: '+14155550121', status: 'online', unread: 2 },
    { id: 'peer-003', name: 'Tokyo Mesh', phone: '+81312345678', status: 'offline', unread: 0 },
  ]);
  const [activeContactId, setActiveContactId] = useState('peer-001');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  const t = MESSAGES[locale];
  const canSend = useMemo(() => isPhoneValid(normalizePhone(to)) && message.trim().length > 0, [to, message]);
  const normalizedPhone = normalizePhone(phoneInput);
  const phoneValid = isPhoneValid(normalizedPhone);
  const nicknameValid = nicknameInput.trim().length >= 2 && nicknameInput.trim().length <= 24;
  const canLogin = phoneValid && nicknameValid;

  const activeContact = useMemo(
    () => contacts.find((contact) => contact.id === activeContactId) ?? contacts[0],
    [activeContactId, contacts]
  );

  useEffect(() => {
    if (activeContact?.phone) {
      setTo(activeContact.phone);
    }
  }, [activeContact]);

  useEffect(() => {
    setChatMessages((current) => {
      if (current.length === 0) {
        return current;
      }
      const [first, ...rest] = current;
      return [{ ...first, text: t.welcome }, ...rest];
    });
  }, [t.welcome]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const browserLocale = window.navigator.language?.toLowerCase() ?? 'en';
    setLocale(browserLocale.startsWith('sq') ? 'sq' : 'en');

    const persisted = window.localStorage.getItem('nodesms-auth-profile');
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted) as AuthProfile;
        if (parsed.phone && parsed.nickname) {
          setAuthProfile(parsed);
        }
      } catch {
        window.localStorage.removeItem('nodesms-auth-profile');
      }
    }

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallReady(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const installPwa = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallReady(false);
  };

  const sendMessage = async () => {
    setLoading(true);
    const recipientPhone = normalizePhone(to);

    const localId = `local_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: localId,
      text: message,
      direction: 'out',
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setChatMessages((current) => [...current, optimisticMessage]);

    try {
      const send = await fetch('/api/nodesms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientPhone,
          from: authProfile ? `${authProfile.nickname} (${authProfile.phone})` : 'anonymous',
          message,
          channel,
          encoding,
          priority: 'normal',
        }),
      });

      const sendJson = (await send.json()) as SendResponse;
      setSendResult(sendJson);
      setLastSync(new Date().toLocaleTimeString());

      if (sendJson.ok) {
        setChatMessages((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  id: sendJson.data?.id ?? item.id,
                  status: channel === 'lorawan' ? 'sent' : 'delivered',
                }
              : item
          )
        );
        setMessage('');
      } else {
        setChatMessages((current) =>
          current.map((item) => (item.id === localId ? { ...item, status: 'failed' } : item))
        );
      }
    } catch {
      setChatMessages((current) =>
        current.map((item) => (item.id === localId ? { ...item, status: 'failed' } : item))
      );
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: Contact['status']) => (status === 'online' ? '#34d399' : '#64748b');

  const messageStatusLabel = (status: ChatMessage['status']) => {
    if (status === 'sending') return '⏳';
    if (status === 'sent') return '✓';
    if (status === 'delivered') return '✓✓';
    return '⚠';
  };

  const handleAuthLogin = () => {
    if (!canLogin) {
      return;
    }

    const profile: AuthProfile = {
      phone: normalizedPhone,
      nickname: nicknameInput.trim(),
    };

    setAuthProfile(profile);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nodesms-auth-profile', JSON.stringify(profile));
    }
  };

  const handleAuthLogout = () => {
    setAuthProfile(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('nodesms-auth-profile');
    }
  };

  if (!authProfile) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 60%, #111827 100%)',
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          padding: '1rem',
        }}
      >
        <section
          suppressHydrationWarning
          style={{
            width: '100%',
            maxWidth: 420,
            background: '#0b1324',
            border: '1px solid #1f2937',
            borderRadius: 16,
            padding: '1rem',
            display: 'grid',
            gap: '0.7rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Hyr në NodeSMS</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
            {t.loginSubtitle}
          </p>

          <label style={{ display: 'grid', gap: 6, fontSize: '0.82rem' }}>
            Language
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
              }}
            >
              <option value="en">English (US)</option>
              <option value="sq">Shqip (AL)</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: '0.82rem' }}>
            {t.phoneLabel}
            <input
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder='+15551234567'
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: 10,
                border: `1px solid ${phoneInput.length > 0 && !phoneValid ? '#ef4444' : '#334155'}`,
                background: '#0f172a',
                color: '#e2e8f0',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: '0.82rem' }}>
            {t.nicknameLabel}
            <input
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              placeholder='e.g. eurocoder'
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: 10,
                border: `1px solid ${nicknameInput.length > 0 && !nicknameValid ? '#ef4444' : '#334155'}`,
                background: '#0f172a',
                color: '#e2e8f0',
              }}
            />
          </label>

          <button
            onClick={handleAuthLogin}
            disabled={!canLogin}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '0.65rem 1rem',
              background: canLogin ? '#10b981' : '#334155',
              color: '#052e16',
              fontWeight: 700,
              cursor: canLogin ? 'pointer' : 'not-allowed',
            }}
          >
            {t.continue}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 60%, #111827 100%)',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '1rem' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            background: 'rgba(2, 6, 23, 0.8)',
            border: '1px solid #1f2937',
            borderRadius: 16,
            padding: '0.8rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.8rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.1rem', margin: 0 }}>{t.messengerTitle}</h1>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              {t.messengerSubtitle} {lastSync ? `• ${t.sync} ${lastSync}` : ''}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#7dd3fc', margin: 0 }}>
              @{authProfile.nickname} • {authProfile.phone}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {installReady && (
              <button
                onClick={installPwa}
                style={{
                  border: 0,
                  borderRadius: 999,
                  background: '#10b981',
                  color: '#052e16',
                  fontWeight: 700,
                  padding: '0.45rem 0.9rem',
                  cursor: 'pointer',
                }}
              >
                {t.install}
              </button>
            )}
            <button
              onClick={handleAuthLogout}
              style={{
                border: '1px solid #334155',
                borderRadius: 999,
                background: '#0f172a',
                color: '#cbd5e1',
                fontWeight: 600,
                padding: '0.45rem 0.8rem',
                cursor: 'pointer',
              }}
            >
              {t.logout}
            </button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '0.8rem' }}>
          <aside
            style={{
              background: '#0b1324',
              border: '1px solid #1f2937',
              borderRadius: 16,
              padding: '0.7rem',
              minHeight: '70vh',
            }}
          >
            <h2 style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0.6rem 0.3rem' }}>{t.contacts}</h2>
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {contacts.map((contact) => {
                const selected = contact.id === activeContactId;
                return (
                  <button
                    key={contact.id}
                    onClick={() => setActiveContactId(contact.id)}
                    style={{
                      border: selected ? '1px solid #38bdf8' : '1px solid #1f2937',
                      background: selected ? '#0c1f34' : '#0f172a',
                      color: '#e2e8f0',
                      borderRadius: 12,
                      padding: '0.55rem 0.65rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{contact.name}</strong>
                      {contact.unread > 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            borderRadius: 999,
                            background: '#22c55e',
                            color: '#052e16',
                            minWidth: 20,
                            textAlign: 'center',
                            padding: '0.05rem 0.35rem',
                          }}
                        >
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{contact.phone}</div>
                    <div style={{ fontSize: '0.72rem', color: statusColor(contact.status) }}>
                      {contact.status === 'online' ? `● ${t.online}` : `● ${t.offline}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section
            style={{
              background: '#0b1324',
              border: '1px solid #1f2937',
              borderRadius: 16,
              minHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #1f2937',
                padding: '0.7rem 0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{activeContact?.name}</div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{t.recipient}</div>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  style={{
                    marginTop: 4,
                    width: '100%',
                    maxWidth: 210,
                    borderRadius: 8,
                    border: `1px solid ${isPhoneValid(normalizePhone(to)) ? '#334155' : '#ef4444'}`,
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.45rem',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as 'http' | 'lorawan')}
                  style={{
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    padding: '0.4rem',
                  }}
                >
                  <option value="http">{t.channelHttp}</option>
                  <option value="lorawan">{t.channelLora}</option>
                </select>
                <select
                  value={encoding}
                  onChange={(event) => setEncoding(event.target.value as 'cbor' | 'msgpack')}
                  style={{
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    padding: '0.4rem',
                  }}
                >
                  <option value="cbor">{t.cbor}</option>
                  <option value="msgpack">{t.msgpack}</option>
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'grid', gap: '0.6rem' }}>
              {chatMessages.map((entry) => {
                const outgoing = entry.direction === 'out';
                return (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: outgoing ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '78%',
                        borderRadius: 14,
                        padding: '0.55rem 0.7rem',
                        background: outgoing ? '#2563eb' : '#1f2937',
                        color: '#f8fafc',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{entry.text}</div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: '0.68rem',
                          opacity: 0.85,
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {outgoing && <span>{messageStatusLabel(entry.status)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid #1f2937', padding: '0.65rem', display: 'grid', gap: '0.5rem' }}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                placeholder={t.typeMessage}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 10,
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  resize: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {channel === 'lorawan' ? t.channelLoraLive : t.channelHttpLive}
                </div>
                <button
                  disabled={!canSend || loading}
                  onClick={sendMessage}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    padding: '0.5rem 0.95rem',
                    background: canSend ? '#10b981' : '#334155',
                    color: '#052e16',
                    fontWeight: 700,
                    cursor: canSend ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? t.sending : t.send}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section
          style={{
            marginTop: '0.8rem',
            background: '#0b1324',
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: '0.7rem 0.8rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem' }}>{t.debugTitle}</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.76rem', color: '#93c5fd', maxHeight: 180, overflowY: 'auto' }}>
            {JSON.stringify(sendResult, null, 2)}
          </pre>
        </section>
      </section>
    </main>
  );
}
