"use client";

import React from "react";

export default function Testimonials() {
  const reviews = [
    {
      quote:
        "SinAi has cut our breaking news headline drafting time in half while ensuring our grammar strictly adheres to standard national newspaper conventions.",
      author: "Nalinda Jayawardena",
      role: "Editor-in-Chief, National Daily",
      avatar: "NJ",
    },
    {
      quote:
        "The ability to effortlessly decode legacy UBIN-encoded newsroom archives into Unicode while running instant syntactic corrections is a game changer for Sri Lankan journalism.",
      author: "Dr. Sanduni Perera",
      role: "Computational Linguistics Researcher",
      avatar: "SP",
    },
    {
      quote:
        "The 5-tone style engine lets our journalists rapidly adjust reporting for our print newspaper, broadcast teleprompter, and social channels simultaneously.",
      author: "Rohan Wickremasinghe",
      role: "Digital Media Director",
      avatar: "RW",
    },
  ];

  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5]">
      {/* Central Big Testimonial (Lumio Style) */}
      <div className="max-w-4xl mx-auto text-center flex flex-col items-center mb-12 sm:mb-20">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-4 sm:mb-6 block">
          Editorial Endorsement
        </span>
        <h2 className="font-display text-xl sm:text-3xl md:text-4xl lg:text-5xl font-normal leading-[1.25] text-[#181818] tracking-tight text-balance mb-6 sm:mb-10">
          &ldquo;SinAi was engineered with the conviction that native language newsrooms deserve the same high-caliber, domain-adapted AI intelligence available in major global languages.&rdquo;
        </h2>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#181818] text-white flex items-center justify-center font-display font-bold text-sm sm:text-base shadow-md shrink-0">
            AM
          </div>
          <div className="text-left">
            <p className="text-xs sm:text-sm font-bold text-[#181818]">Asanka Mendis</p>
            <p className="text-[10px] sm:text-xs text-[#8C8880]">Head of Editorial Systems, Media Lab</p>
          </div>
        </div>
      </div>

      {/* 3-Column Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
        {reviews.map((r, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#D9D7D0] shadow-sm hover:border-[#cd191a]/40 transition-all duration-300 flex flex-col justify-between"
          >
            <p className="font-display text-sm sm:text-base text-[#181818] italic leading-relaxed mb-4 sm:mb-6">
              &ldquo;{r.quote}&rdquo;
            </p>
            <div className="flex items-center gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-[#F0EFEB]">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#cd191a] to-[#ab1112] text-white flex items-center justify-center font-bold text-xs font-display shrink-0">
                {r.avatar}
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#181818]">{r.author}</h4>
                <p className="text-[10px] sm:text-[11px] text-[#8C8880]">{r.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
