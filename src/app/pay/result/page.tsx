export default async function PayResult({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const view =
    status === "success"
      ? { icon: "✓", title: "تم الدفع بنجاح", text: "شكرًا لك، تم استلام دفعتك.", cls: "bg-green-100 text-green-700" }
      : status === "cancel"
        ? { icon: "↩", title: "تم إلغاء عملية الدفع", text: "لم يتم خصم أي مبلغ.", cls: "bg-gray-100 text-gray-700" }
        : { icon: "!", title: "لم تكتمل عملية الدفع", text: "يرجى المحاولة مرة أخرى أو التواصل معنا.", cls: "bg-red-100 text-red-700" };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${view.cls}`}>
          {view.icon}
        </div>
        <h1 className="text-xl font-bold">{view.title}</h1>
        <p className="text-gray-500">{view.text}</p>
      </div>
    </div>
  );
}
