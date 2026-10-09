export default function ManufacturerLoading() {
  return <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10"><div className="h-2 w-32 bg-[#e9e8e3]" /><div className="mt-3 h-8 w-52 bg-[#eeede8]" /><div className="mt-8 grid grid-cols-3 border border-line">{[1,2,3].map((item)=><div key={item} className="p-4"><div className="h-2 w-24 bg-[#e9e8e3]" /><div className="mt-4 h-7 w-12 bg-[#eeede8]" /></div>)}</div><div className="mt-8 h-52 border border-line bg-[#f5f4f0]" /></main>;
}
