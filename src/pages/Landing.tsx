import { Link } from "react-router-dom";
import styles from "./Landing.module.css";

// Portada pública (/): es el deck "landing logos" pasado a HTML, una sección
// por slide. Las fotos con el corte en diagonal vienen recortadas de las slides
// (public/brand/landing-*.jpg); logos, líneas y textos son HTML real para que
// no se vean pixelados al escalar. Arriba a la derecha va el acceso a la
// plataforma.
export function Landing() {
  return (
    <div className={styles.page}>
      {/* Slide 1: portada. */}
      <section className={styles.hero}>
        <img src="/brand/landing-hero.jpg" alt="" aria-hidden="true" className={styles.heroImg} />
        <div className={styles.veil} aria-hidden="true" />
        <div className={styles.scrim} aria-hidden="true" />

        <header className={styles.header}>
          <img src="/brand/isologo-blanco.png" alt="Incoming Hub" className={styles.logo} />
          <Link to="/login" className={styles.login}>
            Ingresar
          </Link>
        </header>

        <div className={styles.heroMain}>
          <div className={styles.rule} aria-hidden="true" />
          <h1 className={styles.tagline}>Una Plataforma, cero sorpresas.</h1>
        </div>

        <div className={styles.heroFoot}>www.incoming-hub.com</div>
      </section>

      {/* Slide 2: la propuesta. */}
      <section className={styles.receptivo}>
        <div className={styles.copy}>
          <h2 className={styles.title}>Pensado para el Receptivo.</h2>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.lead}>
            Incoming Hub existe para que el transfer deje de ser el eslabón débil de tu operación
            y se transforme en parte de la experiencia que ofreces y que hace que los pasajeros
            vuelvan.
          </p>
          <p className={styles.strong}>
            Transfers validados, fáciles de cargar y con seguimiento en tiempo real.
          </p>
          <p className={styles.lead}>
            Vos cargas el servicio. Nosotros garantizamos que lo cubra una unidad habilitada y en
            condiciones.
          </p>
        </div>
        <div className={styles.cityWrap}>
          <img src="/brand/landing-city.jpg" alt="" aria-hidden="true" className={styles.city} />
        </div>
      </section>

      {/* Slide 3: funcionamiento. */}
      <section className={styles.simple}>
        <h2 className={styles.title}>Simple de verdad.</h2>
        <div className={styles.rule} aria-hidden="true" />

        <ol className={styles.steps}>
          <li className={styles.step}>
            <img src="/brand/landing-step1.png" alt="" aria-hidden="true" className={styles.stepIcon} />
            <span className={styles.stepNum}>01</span>
            <p className={styles.stepText}>
              Cargas tus traslados: manual, subiendo un Excel o conectando tu sistema.
            </p>
          </li>
          <li className={styles.step}>
            <img src="/brand/landing-step2.png" alt="" aria-hidden="true" className={styles.stepIcon} />
            <span className={styles.stepNum}>02</span>
            <p className={styles.stepText}>
              La plataforma asigna una unidad validada según tus preferencias.
            </p>
          </li>
          <li className={styles.step}>
            <img src="/brand/landing-step3.png" alt="" aria-hidden="true" className={styles.stepIcon} />
            <span className={styles.stepNum}>03</span>
            <p className={styles.stepText}>
              Seguís el estado de cada traslado en tiempo real, de punta a punta.
            </p>
          </li>
        </ol>

        <div className={styles.banner}>Tan simple como suena. Poco esfuerzo, control total.</div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerSite}>www.incoming-hub.com</span>
        <Link to="/login" className={styles.footerLogin}>
          Ingresar a la plataforma
        </Link>
        <img src="/brand/isotipo-negro.png" alt="" aria-hidden="true" className={styles.footerMark} />
      </footer>
    </div>
  );
}
