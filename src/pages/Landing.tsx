import { Link } from "react-router-dom";
import styles from "./Landing.module.css";

// Portada pública (/): es la slide 1 del deck "landing logos" pasada a HTML.
// La foto del aeropuerto con el corte en diagonal viene recortada de esa slide
// (public/brand/landing-hero.jpg); el logo, la línea y la frase son texto real
// para que no se vean pixelados al escalar. Arriba a la derecha va el acceso a
// la plataforma.
export function Landing() {
  return (
    <div className={styles.page}>
      <img src="/brand/landing-hero.jpg" alt="" aria-hidden="true" className={styles.hero} />
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />

      <header className={styles.header}>
        <img src="/brand/isologo-blanco.png" alt="Incoming Hub" className={styles.logo} />
        <Link to="/login" className={styles.login}>
          Ingresar
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.rule} aria-hidden="true" />
        <h1 className={styles.tagline}>Una Plataforma, cero sorpresas.</h1>
      </main>

      <footer className={styles.footer}>www.incoming-hub.com</footer>
    </div>
  );
}
