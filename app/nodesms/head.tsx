export default function Head() {
  return (
    <>
      <title>NodeSMS Messenger</title>
      <meta name="description" content="NodeSMS Messenger PWA for massive mobile communication over real HTTP and real LoRaWAN services." />
      <meta name="theme-color" content="#0b1220" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="NodeSMS" />
      <link rel="manifest" href="/nodesms-manifest.json" />
      <link rel="icon" href="/favicon.svg" />
    </>
  );
}
