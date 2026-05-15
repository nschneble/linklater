import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col items-center justify-center min-h-[85vh] px-6 py-24 text-center animate-fade-in-up">
      <div className="flex items-center justify-center w-16 h-16 mb-6 bg-[#1a1530] border border-[#2e2855] rounded-2xl">
        <i
          className="fa-solid fa-link text-2xl text-[#c03812]"
          aria-hidden="true"
        />
      </div>
      <h1 className="mb-3 text-5xl sm:text-6xl font-bold tracking-tight select-none bg-gradient-to-br from-[#eeeede] to-[#c03812] bg-clip-text text-transparent">
        Linklater
      </h1>
      <p className="mb-5 text-lg sm:text-xl font-medium text-[#9b92c8] select-none">
        Save links now, read them later.
      </p>
      <p className="max-w-sm sm:max-w-md mb-10 text-sm text-[#9b92c8] leading-relaxed select-none">
        Most curious adults come across dozens of interesting articles on any
        given day. Do they have time to read them all? Nope. Do they often
        forget about them? Totally.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c03812] hover:bg-[#7c2510] text-[#eeeede] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c03812] rounded-full transition duration-200 active:scale-[0.96] cursor-pointer"
          onClick={() => navigate('/signup')}
        >
          <i className="fa-solid fa-meteor text-xs" aria-hidden="true" />
          Get started free
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2e2855] hover:border-[#9b92c8] text-[#9b92c8] hover:text-[#eeeede] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b92c8] rounded-full transition duration-200 active:scale-[0.96] cursor-pointer"
          onClick={() => navigate('/login')}
        >
          Log in
        </button>
      </div>
    </section>
  );
}
