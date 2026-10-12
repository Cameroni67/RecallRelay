export default function NotificationsLoading() {
  return (
    <main className="mx-auto max-w-[1040px] animate-pulse px-4 py-9 sm:px-7 lg:px-10">
      <div className="h-2 w-28 bg-[#e9e8e3]" />
      <div className="mt-3 h-8 w-56 bg-[#eeede8]" />
      <div className="mt-2 h-3 w-80 bg-[#eeede8]" />
      <div className="mt-7 max-w-3xl space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="border border-line p-4">
            <div className="h-3 w-52 bg-[#e9e8e3]" />
            <div className="mt-2 h-3 w-full max-w-md bg-[#eeede8]" />
            <div className="mt-2 h-2 w-32 bg-[#eeede8]" />
          </div>
        ))}
      </div>
    </main>
  );
}
