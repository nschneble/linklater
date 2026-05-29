import { Link } from 'react-router-dom';

export default function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="flex flex-col items-center justify-center min-h-[85vh] px-6 py-24 text-center animate-fade-in-up"
    >
      <div className="flex items-center justify-center w-16 h-16 mb-6 bg-midnight border border-boyhood rounded-2xl">
        <i
          className="fa-solid fa-link text-2xl text-sunrise"
          aria-hidden="true"
        />
      </div>
      <h1
        id="hero-heading"
        className="mb-3 text-5xl sm:text-6xl font-bold tracking-tight select-none bg-gradient-to-br from-dazed to-sunrise bg-clip-text text-transparent"
      >
        Linklater
      </h1>
      <p className="mb-5 text-lg sm:text-xl font-medium text-confused select-none">
        Save links now, read them later.
      </p>
      <p className="max-w-sm sm:max-w-md mb-10 text-sm text-confused text-balance leading-relaxed select-none">
        Most curious adults come across dozens of interesting articles on any
        given day. Do they have time to read them all? Nope. Do they often
        forget about them? Totally.
      </p>
      <div className="flex items-center gap-3 select-none">
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sunrise hover:bg-sunset text-dazed text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sunrise rounded-full transition duration-200 active:scale-[0.96] cursor-pointer"
        >
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true" />
          Get started free
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-boyhood hover:border-confused text-confused hover:text-dazed text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confused rounded-full transition duration-200 active:scale-[0.96] cursor-pointer"
        >
          Log in
        </Link>
      </div>
    </section>
  );
}
