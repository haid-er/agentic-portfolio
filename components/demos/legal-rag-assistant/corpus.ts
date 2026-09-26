/**
 * A small public-domain legal corpus: provisions of the Constitution of the United States
 * (text as transcribed by the U.S. National Archives, original spelling and capitals).
 * `heading` is an editorial plain-language label added for this demo; it is not part of the text.
 * Long provisions are split into clause-sized chunks at semicolons, like a real RAG ingest.
 */
export interface Provision {
  id: string
  /** Short citation, e.g. "Amend. VI". */
  cite: string
  /** Year adopted (ratified). */
  year: number
  heading: string
  text: string
  /** True when only part of the provision is included. */
  excerpt?: boolean
}

export const SOURCE_NAME = 'Constitution of the United States'
export const SOURCE_URL = 'https://www.archives.gov/founding-docs/constitution-transcript'

export const PROVISIONS: readonly Provision[] = [
  { id: 'a1-9-2', cite: 'Art. I, § 9, cl. 2', year: 1788, heading: 'Habeas corpus', text: 'The Privilege of the Writ of Habeas Corpus shall not be suspended, unless when in Cases of Rebellion or Invasion the public Safety may require it.' },
  { id: 'a1-9-3', cite: 'Art. I, § 9, cl. 3', year: 1788, heading: 'No bills of attainder or ex post facto laws', text: 'No Bill of Attainder or ex post facto Law shall be passed.' },
  { id: 'a2-1-5', cite: 'Art. II, § 1, cl. 5', year: 1788, heading: 'Who can be President', text: 'No Person except a natural born Citizen, or a Citizen of the United States, at the time of the Adoption of this Constitution, shall be eligible to the Office of President; neither shall any Person be eligible to that Office who shall not have attained to the Age of thirty five Years, and been fourteen Years a Resident within the United States.' },
  { id: 'a3-3-1', cite: 'Art. III, § 3, cl. 1', year: 1788, heading: 'Treason', text: 'Treason against the United States, shall consist only in levying War against them, or in adhering to their Enemies, giving them Aid and Comfort. No Person shall be convicted of Treason unless on the Testimony of two Witnesses to the same overt Act, or on Confession in open Court.' },
  { id: 'a6-3', cite: 'Art. VI, cl. 3', year: 1788, heading: 'Oath of office; no religious test', text: 'The Senators and Representatives before mentioned, and the Members of the several State Legislatures, and all executive and judicial Officers, both of the United States and of the several States, shall be bound by Oath or Affirmation, to support this Constitution; but no religious Test shall ever be required as a Qualification to any Office or public Trust under the United States.' },
  { id: 'am1', cite: 'Amend. I', year: 1791, heading: 'Freedom of religion, speech, press, assembly and petition', text: 'Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.' },
  { id: 'am2', cite: 'Amend. II', year: 1791, heading: 'Right to keep and bear arms', text: 'A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.' },
  { id: 'am3', cite: 'Amend. III', year: 1791, heading: 'Quartering of soldiers', text: 'No Soldier shall, in time of peace be quartered in any house, without the consent of the Owner, nor in time of war, but in a manner to be prescribed by law.' },
  { id: 'am4', cite: 'Amend. IV', year: 1791, heading: 'Searches, seizures and warrants', text: 'The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.' },
  { id: 'am5', cite: 'Amend. V', year: 1791, heading: 'Grand jury, double jeopardy, self-incrimination, due process, takings', text: 'No person shall be held to answer for a capital, or otherwise infamous crime, unless on a presentment or indictment of a Grand Jury, except in cases arising in the land or naval forces, or in the Militia, when in actual service in time of War or public danger; nor shall any person be subject for the same offence to be twice put in jeopardy of life or limb; nor shall be compelled in any criminal case to be a witness against himself, nor be deprived of life, liberty, or property, without due process of law; nor shall private property be taken for public use, without just compensation.' },
  { id: 'am6', cite: 'Amend. VI', year: 1791, heading: 'Rights of the accused: speedy trial, jury, counsel', text: 'In all criminal prosecutions, the accused shall enjoy the right to a speedy and public trial, by an impartial jury of the State and district wherein the crime shall have been committed, which district shall have been previously ascertained by law, and to be informed of the nature and cause of the accusation; to be confronted with the witnesses against him; to have compulsory process for obtaining witnesses in his favor, and to have the Assistance of Counsel for his defence.' },
  { id: 'am7', cite: 'Amend. VII', year: 1791, heading: 'Jury trial in civil cases', text: 'In Suits at common law, where the value in controversy shall exceed twenty dollars, the right of trial by jury shall be preserved, and no fact tried by a jury, shall be otherwise re-examined in any Court of the United States, than according to the rules of the common law.' },
  { id: 'am8', cite: 'Amend. VIII', year: 1791, heading: 'Bail, fines and punishment', text: 'Excessive bail shall not be required, nor excessive fines imposed, nor cruel and unusual punishments inflicted.' },
  { id: 'am9', cite: 'Amend. IX', year: 1791, heading: 'Rights retained by the people', text: 'The enumeration in the Constitution, of certain rights, shall not be construed to deny or disparage others retained by the people.' },
  { id: 'am10', cite: 'Amend. X', year: 1791, heading: 'Powers reserved to the states and the people', text: 'The powers not delegated to the United States by the Constitution, nor prohibited by it to the States, are reserved to the States respectively, or to the people.' },
  { id: 'am13', cite: 'Amend. XIII, § 1', year: 1865, heading: 'Abolition of slavery', text: 'Neither slavery nor involuntary servitude, except as a punishment for crime whereof the party shall have been duly convicted, shall exist within the United States, or any place subject to their jurisdiction.' },
  { id: 'am14', cite: 'Amend. XIV, § 1', year: 1868, heading: 'Citizenship, due process and equal protection', text: 'All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside. No State shall make or enforce any law which shall abridge the privileges or immunities of citizens of the United States; nor shall any State deprive any person of life, liberty, or property, without due process of law; nor deny to any person within its jurisdiction the equal protection of the laws.' },
  { id: 'am15', cite: 'Amend. XV, § 1', year: 1870, heading: 'Voting rights regardless of race', text: 'The right of citizens of the United States to vote shall not be denied or abridged by the United States or by any State on account of race, color, or previous condition of servitude.' },
  { id: 'am19', cite: 'Amend. XIX', year: 1920, heading: 'Voting rights regardless of sex', text: 'The right of citizens of the United States to vote shall not be denied or abridged by the United States or by any State on account of sex. Congress shall have power to enforce this article by appropriate legislation.' },
  { id: 'am22', cite: 'Amend. XXII, § 1', year: 1951, heading: 'Presidential term limit', excerpt: true, text: 'No person shall be elected to the office of the President more than twice, and no person who has held the office of President, or acted as President, for more than two years of a term to which some other person was elected President shall be elected to the office of the President more than once.' },
  { id: 'am26', cite: 'Amend. XXVI, § 1', year: 1971, heading: 'Voting age of eighteen', text: 'The right of citizens of the United States, who are eighteen years of age or older, to vote shall not be denied or abridged by the United States or by any State on account of age.' },
]

export interface Chunk {
  id: string
  provision: Provision
  /** 1-based part number within the provision, and the total. */
  part: number
  parts: number
  text: string
}

const MAX_CHUNK = 300

/** Split long provisions at semicolons, packing clauses up to ~300 characters. */
export function buildChunks(provisions: readonly Provision[] = PROVISIONS): Chunk[] {
  return provisions.flatMap((p) => {
    if (p.text.length <= MAX_CHUNK) return [{ id: p.id, provision: p, part: 1, parts: 1, text: p.text }]
    const clauses = p.text.split(/(?<=;)\s+/)
    const packed: string[] = []
    for (const c of clauses) {
      const last = packed[packed.length - 1]
      if (last && last.length + c.length + 1 <= MAX_CHUNK) packed[packed.length - 1] = `${last} ${c}`
      else packed.push(c)
    }
    return packed.map((text, i) => ({ id: `${p.id}.${i + 1}`, provision: p, part: i + 1, parts: packed.length, text }))
  })
}

export const SAMPLE_QUESTIONS: readonly string[] = [
  'Do I have the right to a lawyer if I am charged with a crime?',
  'Can I be tried twice for the same crime?',
  'Can the government house soldiers in my home?',
  'Does the police need a warrant to search my house?',
  'How old do you have to be to become President?',
  'Can women be denied the vote?',
]
