import { Plus } from "lucide-react";
import { useState } from "react";
const faqs = [
  [
    "Was darf der Scout selbstständig tun?",
    "Er recherchiert und kann nicht-bindende Anfragen innerhalb einer genau freigegebenen Aktion oder eines aktiven, begrenzten Mandats übernehmen. Zusagen, Buchungen und Zahlungen benötigen immer eure exakte Freigabe.",
  ],
  [
    "Muss ich mit dem Scout sprechen?",
    "Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.",
  ],
  [
    "Funktioniert das schon auf allen Portalen?",
    "Noch nicht. Die aktuelle kontrollierte Demo zeigt einen begrenzten Ablauf. Öffentliche Quellen und Kontaktwege werden einzeln geprüft; die illustrative Geschichte auf dieser Seite kontaktiert niemanden.",
  ],
] as const;
export function LandingFaq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="landing-faq" id="control">
      <div>
        <p className="landing-overline">Klar geregelt</p>
        <h2>
          Euer Scout übernimmt.
          <br />
          Ihr behaltet das letzte Wort.
        </h2>
        <p>
          Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was
          er sich merkt.
        </p>
      </div>
      <div>
        {faqs.map(([question, answer], index) => (
          <article className={open === index ? "is-open" : ""} key={question}>
            <button
              aria-expanded={open === index}
              onClick={() => setOpen(open === index ? -1 : index)}
              type="button"
            >
              <span>{question}</span>
              <i>
                <Plus />
              </i>
            </button>
            <div>
              <p>{answer}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
