import { useEffect } from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { HomeHero } from '../components/sections/HomeHero';
import { BrandStatement } from '../components/sections/BrandStatement';
import { Mission } from '../components/sections/Mission';
import { CoreValues } from '../components/sections/CoreValues';
import { WhatWeDo } from '../components/sections/WhatWeDo';
import { Impact } from '../components/sections/Impact';
import { FounderMessage } from '../components/sections/FounderMessage';
import { ClosingCta } from '../components/sections/ClosingCta';

export function Home() {
  useEffect(() => {
    document.title = 'Apex Badminton Club — Growing Badminton. Building Community. Inspiring Players.';
  }, []);

  return (
    <>
      <Nav />
      <main id="top">
        <HomeHero />
        <BrandStatement />
        <Mission />
        <CoreValues />
        <WhatWeDo />
        <Impact />
        <FounderMessage />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
