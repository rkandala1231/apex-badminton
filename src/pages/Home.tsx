import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Hero } from '../components/sections/Hero';
import { Mission } from '../components/sections/Mission';
import { Registration } from '../components/sections/Registration';
import { Tournament } from '../components/sections/Tournament';
import { Formats } from '../components/sections/Formats';
import { Analytics } from '../components/sections/Analytics';

export function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <Mission />
        <Registration />
        <Tournament />
        <Formats />
        <Analytics />
      </main>
      <Footer />
    </>
  );
}
