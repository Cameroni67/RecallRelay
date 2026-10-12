export default function ProductDetailLoading() {
  return (
    <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10">
      <div className="h-2 w-32 bg-[#e9e8e3]" />
      <div className="mt-3 h-3 w-full max-w-3xl bg-[#eeede8]" />
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="aspect-[1.28/1] w-full bg-[#eeede8]" />
          <div className="h-56 w-full border border-line bg-[#f3f2ee]" />
        </div>
        <div>
          <div className="h-2 w-40 bg-[#e9e8e3]" />
          <div className="mt-3 h-10 w-64 bg-[#eeede8]" />
          <div className="mt-5 border-t border-line pt-5">
            <div className="h-24 w-full bg-[#f3f2ee]" />
          </div>
          <div className="mt-5 h-10 w-44 bg-[#eeede8]" />
        </div>
      </div>
      <div className="mt-8 h-40 w-full border-t border-line bg-transparent" />
    </main>
  );
}
