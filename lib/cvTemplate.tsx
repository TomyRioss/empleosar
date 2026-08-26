import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ExperienceEntry, EducationEntry } from "@/lib/profileTypes";

export type CvContent = {
  fullName: string;
  contactLine: string;
  summary: string;
  experience: (ExperienceEntry & { dateRange: string })[];
  education: (EducationEntry & { dateRange: string })[];
  certifications: string[];
  skills: string[];
  languages: string[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  name: { fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 4, letterSpacing: 1 },
  contact: { fontSize: 9.5, textAlign: "center", marginBottom: 14, color: "#333" },
  summary: { marginBottom: 16, lineHeight: 1.4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    borderBottom: "1pt solid #1a1a1a",
    paddingBottom: 3,
    marginBottom: 8,
    marginTop: 14,
  },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  entryTitle: { fontWeight: 700, fontSize: 10.5 },
  entryDate: { fontSize: 9.5, fontWeight: 700 },
  entrySubtitle: { fontStyle: "italic", fontSize: 10, marginBottom: 3 },
  entryDescription: { lineHeight: 1.35, marginBottom: 8 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

function EntryList({ items }: { items: CvContent["experience"] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} wrap={false}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>{item.title}</Text>
            <Text style={styles.entryDate}>{item.dateRange}</Text>
          </View>
          <Text style={styles.entrySubtitle}>{item.company}</Text>
          <Text style={styles.entryDescription}>{item.description}</Text>
        </View>
      ))}
    </>
  );
}

function EducationList({ items }: { items: CvContent["education"] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} wrap={false}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>{item.institution}</Text>
            <Text style={styles.entryDate}>{item.dateRange}</Text>
          </View>
          <Text style={styles.entrySubtitle}>{item.degree}</Text>
          {item.description && <Text style={styles.entryDescription}>{item.description}</Text>}
        </View>
      ))}
    </>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function HarvardCv({ content }: { content: CvContent }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{content.fullName}</Text>
        <Text style={styles.contact}>{content.contactLine}</Text>
        {content.summary && <Text style={styles.summary}>{content.summary}</Text>}

        {content.experience.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experiencia Laboral</Text>
            <EntryList items={content.experience} />
          </>
        )}

        {content.education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Educación</Text>
            <EducationList items={content.education} />
          </>
        )}

        {content.certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Certificaciones</Text>
            <BulletList items={content.certifications} />
          </>
        )}

        {(content.languages.length > 0 || content.skills.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Habilidades Profesionales y Personales</Text>
            {content.languages.length > 0 && (
              <BulletList items={[`Idiomas: ${content.languages.join(", ")}`]} />
            )}
            {content.skills.length > 0 && <BulletList items={content.skills} />}
          </>
        )}
      </Page>
    </Document>
  );
}

export async function renderHarvardCv(content: CvContent): Promise<Buffer> {
  return renderToBuffer(<HarvardCv content={content} />);
}
