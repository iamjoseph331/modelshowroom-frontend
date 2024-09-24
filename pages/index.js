// pages/index.js

import Head from 'next/head';
import ImageUpload from '../components/ImageUpload';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Model Showroom</title>
        <meta name="description" content="Upload images and visualize model predictions." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <ImageUpload />
      </main>

      <footer className={styles.footer}>
        <a
          href="https://github.com/iamjoseph331/ModelShowroom"
          target="_blank"
          rel="noopener noreferrer"
        >
          Joseph Chen 2024
        </a>
      </footer>
    </div>
  );
}
