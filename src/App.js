import React, { useEffect, useMemo, useState } from "react";

// Tiny helpers for localStorage
const LS_KEYS = {
  invoices: "tinmak_invoices_v1",
  counter: "tinmak_invoice_counter_v1",
  settings: "tinmak_settings_v1",
};

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const currency = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "0.00";
  return Number(n).toFixed(2);
};

const defaultItem = () => ({ description: "", qty: 1, price: 0 });

const defaultInvoice = () => ({
  clientName: "",
  clientAddress: "",
  date: new Date().toISOString().slice(0, 10),
  dueDate: "",
  items: [defaultItem()],
  taxRate: 0,
  notes: "",
});

export default function InvoicerApp() {
  const [invoices, setInvoices] = useState(() => loadJSON(LS_KEYS.invoices, []));
  const [counter, setCounter] = useState(() => loadJSON(LS_KEYS.counter, 1));
  const [settings, setSettings] = useState(() =>
    loadJSON(LS_KEYS.settings, {
      businessName: "BlueRock Accounting",
      businessAddress: "Harare, Zimbabwe",
      prefix: "INV-",
      nextNumberPadding: 4,
      currency: "USD",
      footerNote: "Thank you for your business!",
    })
  );

  const [tab, setTab] = useState("new");
  const [form, setForm] = useState(defaultInvoice());
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null); // invoice to preview

  useEffect(() => saveJSON(LS_KEYS.invoices, invoices), [invoices]);
  useEffect(() => saveJSON(LS_KEYS.counter, counter), [counter]);
  useEffect(() => saveJSON(LS_KEYS.settings, settings), [settings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return invoices;
    const q = query.toLowerCase();
    return invoices.filter((inv) =>
      [
        inv.number,
        inv.clientName,
        inv.clientAddress,
        inv.date,
        inv.dueDate,
        inv.total?.toString(),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [invoices, query]);

  const totals = useMemo(() => {
    const sub = form.items.reduce(
      (sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0),
      0
    );
    const tax = sub * (Number(form.taxRate || 0) / 100);
    const total = sub + tax;
    return { sub, tax, total };
  }, [form.items, form.taxRate]);

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, defaultItem()] }));
  }

  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function updateItem(idx, patch) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }

  function resetForm() {
    setForm(defaultInvoice());
  }

  function nextInvoiceNumber() {
    const pad = String(counter).padStart(settings.nextNumberPadding || 0, "0");
    return `${settings.prefix || "INV-"}${pad}`;
  }

  function saveInvoice() {
    if (!form.clientName || form.items.length === 0) {
      alert("Please add client name and at least one item.");
      return;
    }
    const number = nextInvoiceNumber();
    const record = {
      id: crypto.randomUUID(),
      number,
      ...form,
      createdAt: new Date().toISOString(),
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      currency: settings.currency,
      subTotal: Number(totals.sub.toFixed(2)),
      taxAmount: Number(totals.tax.toFixed(2)),
      total: Number(totals.total.toFixed(2)),
      footerNote: settings.footerNote,
    };
    setInvoices((list) => [record, ...list]);
    setCounter((n) => n + 1);
    setViewer(record);
    setTab("invoices");
    resetForm();
  }

  function deleteInvoice(id) {
    if (!confirm("Delete this invoice?")) return;
    setInvoices((list) => list.filter((x) => x.id !== id));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(invoices, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(data)) throw new Error("Invalid file");
        // merge by id (avoid duplicates)
        const map = new Map();
        [...invoices, ...data].forEach((inv) => map.set(inv.id, inv));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setInvoices(merged);
        alert("Import complete.");
      } catch (err) {
        alert("Could not import: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">TinMak Simple Invoicer</h1>
          <nav className="flex gap-2">
            {[
              { k: "new", t: "+ New Invoice" },
              { k: "invoices", t: "Invoices" },
              { k: "settings", t: "Settings" },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => setTab(x.k)}
                className={
                  "px-3 py-2 rounded-xl border text-sm " +
                  (tab === x.k
                    ? "bg-white shadow border-gray-200"
                    : "bg-gray-100 border-transparent")
                }
              >
                {x.t}
              </button>
            ))}
          </nav>
        </header>

        {tab === "new" && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-3">Bill To</h2>
                <label className="block text-sm mb-1">Client / Company</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mb-3"
                  placeholder="Client name"
                  value={form.clientName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientName: e.target.value }))
                  }
                />
                <label className="block text-sm mb-1">Address / Email / Phone</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 h-24"
                  placeholder="Address or contact details"
                  value={form.clientAddress}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientAddress: e.target.value }))
                  }
                />
              </div>

              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-3">Invoice Info</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Due Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dueDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxRate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Items</h2>
                <button
                  onClick={addItem}
                  className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm"
                >
                  Add Item
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="p-2">Description</th>
                      <th className="p-2 w-24">Qty</th>
                      <th className="p-2 w-32">Unit Price</th>
                      <th className="p-2 w-32">Line Total</th>
                      <th className="p-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => {
                      const line = Number(it.qty || 0) * Number(it.price || 0);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <input
                              className="w-full border rounded-lg px-2 py-1"
                              placeholder="e.g., Concrete blocks"
                              value={it.description}
                              onChange={(e) =>
                                updateItem(idx, { description: e.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              className="w-full border rounded-lg px-2 py-1"
                              value={it.qty}
                              onChange={(e) => updateItem(idx, { qty: e.target.value })}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              className="w-full border rounded-lg px-2 py-1"
                              value={it.price}
                              onChange={(e) =>
                                updateItem(idx, { price: e.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">{currency(line)}</td>
                          <td className="p-2 text-right">
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => removeItem(idx)}
                              disabled={form.items.length === 1}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm mb-1">Notes (optional)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 h-28"
                    placeholder="Payment terms, bank details, etc."
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border">
                  <div className="flex justify-between py-1">
                    <span>Subtotal</span>
                    <span>
                      {settings.currency} {currency(totals.sub)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Tax ({form.taxRate || 0}%)</span>
                    <span>
                      {settings.currency} {currency(totals.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t mt-2 font-semibold text-lg">
                    <span>Total</span>
                    <span>
                      {settings.currency} {currency(totals.total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={saveInvoice}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white"
                >
                  Save Invoice
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "invoices" && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <input
                  className="flex-1 border rounded-lg px-3 py-2"
                  placeholder="Search by number, client, date, total..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={exportJSON} className="px-3 py-2 rounded-xl border">
                    Export JSON
                  </button>
                  <label className="px-3 py-2 rounded-xl border cursor-pointer">
                    Import JSON
                    <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr className="text-left">
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Due</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        No invoices yet.
                      </td>
                    </tr>
                  )}
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{inv.number}</td>
                      <td className="p-3">{inv.clientName}</td>
                      <td className="p-3">{inv.date}</td>
                      <td className="p-3">{inv.dueDate || "-"}</td>
                      <td className="p-3 text-right">
                        {inv.currency} {currency(inv.total)}
                      </td>
                      <td className="p-3 text-right space-x-3">
                        <button
                          className="text-blue-700 hover:underline"
                          onClick={() => setViewer(inv)}
                        >
                          View / Print
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => deleteInvoice(inv.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4 grid md:grid-cols-2 gap-4">
              <div>
                <h2 className="font-semibold mb-3">Business Details</h2>
                <label className="block text-sm mb-1">Business Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={settings.businessName}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, businessName: e.target.value }))
                  }
                />
                <label className="block text-sm mb-1">Address / Contacts</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 h-24"
                  value={settings.businessAddress}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, businessAddress: e.target.value }))
                  }
                />
                <label className="block text-sm mb-1 mt-3">Footer Note</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={settings.footerNote}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, footerNote: e.target.value }))
                  }
                />
              </div>
              <div>
                <h2 className="font-semibold mb-3">Numbering & Currency</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Prefix</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={settings.prefix}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, prefix: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Zero Padding</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg px-3 py-2"
                      value={settings.nextNumberPadding}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          nextNumberPadding: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Currency</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={settings.currency}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, currency: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setCounter(1)}
                      className="px-3 py-2 rounded-xl border w-full"
                    >
                      Reset Numbering (to 1)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {viewer && (
          <InvoiceModal invoice={viewer} onClose={() => setViewer(null)} />)
        }

        <footer className="text-xs text-gray-500 mt-8 text-center">
          Data is stored locally in your browser (localStorage). Use Export to back up.
        </footer>
      </div>
    </div>
  );
}

function InvoiceModal({ invoice, onClose }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h3 className="font-semibold">Invoice {invoice.number}</h3>
            <p className="text-xs text-gray-500">Created {new Date(invoice.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl border"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
            <button className="px-3 py-2 rounded-xl border" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="p-6 print:p-0">
          <PrintableInvoice inv={invoice} />
        </div>
      </div>
    </div>
  );
}

function PrintableInvoice({ inv }) {
  return (
    <div className="bg-white text-black">
      <style>{`@media print { body { background: white; } .print\:p-0 { padding: 0 !important } }`}</style>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{inv.businessName}</h2>
            <p className="whitespace-pre-line text-sm text-gray-600">{inv.businessAddress}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold">INVOICE</div>
            <div className="text-sm">No: <span className="font-semibold">{inv.number}</span></div>
            <div className="text-sm">Date: {inv.date}</div>
            <div className="text-sm">Due: {inv.dueDate || "—"}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="font-semibold">Bill To</div>
          <div className="text-sm">{inv.clientName}</div>
          <div className="text-sm whitespace-pre-line text-gray-700">{inv.clientAddress}</div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Description</th>
                <th className="py-2 w-24">Qty</th>
                <th className="py-2 w-32">Unit Price</th>
                <th className="py-2 w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 pr-2">{it.description}</td>
                  <td className="py-2">{it.qty}</td>
                  <td className="py-2">{inv.currency} {Number(it.price).toFixed(2)}</td>
                  <td className="py-2">{inv.currency} {(Number(it.qty) * Number(it.price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {inv.notes && (
              <>
                <div className="font-semibold mb-1">Notes</div>
                <div className="text-sm whitespace-pre-line text-gray-700">{inv.notes}</div>
              </>
            )}
          </div>
          <div className="ml-auto w-full md:w-80">
            <div className="flex justify-between py-1">
              <span>Subtotal</span>
              <span>
                {inv.currency} {Number(inv.subTotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Tax</span>
              <span>
                {inv.currency} {Number(inv.taxAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t mt-2 font-semibold text-lg">
              <span>Total</span>
              <span>
                {inv.currency} {Number(inv.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {inv.footerNote && (
          <div className="mt-8 text-center text-sm text-gray-600">
            {inv.footerNote}
          </div>
        )}
      </div>
    </div>
  );
}
