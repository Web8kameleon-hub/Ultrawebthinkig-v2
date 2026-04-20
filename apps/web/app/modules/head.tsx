export default function Head() {
  const title = "Clisonix Modules | AI Dashboard, Research Tools, and Live Engines";
  const description =
    "Browse the official Clisonix dashboard modules including Curiosity Ocean, Web Reader, Kloud Bridge, EEG analysis, and live AI infrastructure tools.";
  const url = "https://www.clisonix.com/modules";

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="keywords"
        content="Clisonix modules, Clisonix dashboard, Curiosity Ocean, Kloud Bridge, AI tools, EEG analysis"
      />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </>
  );
}
