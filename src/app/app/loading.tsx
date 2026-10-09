export default function OwnerLoading() {
  return <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10"><div className="h-2 w-24 bg-[#e9e8e3]" /><div className="mt-3 h-8 w-48 bg-[#eeede8]" /><div className="mt-2 h-3 w-64 bg-[#eeede8]" /><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item)=><div key={item} className="border border-line p-3"><div className="h-44 bg-[#eeede8]" /><div className="mt-4 h-2 w-28 bg-[#e9e8e3]" /><div className="mt-3 h-4 w-36 bg-[#eeede8]" /></div>)}</div></main>;
}
