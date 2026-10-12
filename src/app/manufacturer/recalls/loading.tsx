export default function ManufacturerRecallsLoading() {
  return (
    <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="h-2 w-52 bg-[#e9e8e3]" />
          <div className="mt-3 h-8 w-40 bg-[#eeede8]" />
        </div>
        <div className="h-10 w-32 bg-[#eeede8]" />
      </div>
      <div className="mt-7 h-2 w-56 bg-[#e9e8e3]" />
      <div className="mt-3 space-y-3">
        {[1, 2].map((item) => (
          <div key={item} className="border border-line p-5">
            <div className="h-2 w-44 bg-[#e9e8e3]" />
            <div className="mt-3 h-4 w-72 bg-[#eeede8]" />
            <div className="mt-3 h-3 w-full max-w-lg bg-[#eeede8]" />
          </div>
        ))}
      </div>
    </main>
  );
}
