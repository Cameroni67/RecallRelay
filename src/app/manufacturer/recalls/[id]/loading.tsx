export default function ManufacturerRecallDetailLoading() {
  return (
    <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10">
      <div className="h-2 w-52 bg-[#e9e8e3]" />
      <div className="mt-3 h-8 w-72 bg-[#eeede8]" />
      <div className="mt-2 h-3 w-56 bg-[#eeede8]" />
      <div className="mt-7 h-36 w-full border border-line bg-[#f3f2ee]" />
      <div className="mt-6 grid border border-line sm:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="border-b border-line p-4 last:border-0">
            <div className="h-2 w-36 bg-[#e9e8e3]" />
            <div className="mt-3 h-5 w-44 bg-[#eeede8]" />
          </div>
        ))}
      </div>
      <div className="mt-7 h-10 w-40 bg-[#eeede8]" />
    </main>
  );
}
