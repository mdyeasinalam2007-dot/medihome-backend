import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang, getDictFor, type Lang, type Dict } from "./dictionaries";

// Server components read the language from the mh_lang cookie (never from the URL).
export const getLang = (): Lang => parseLang(cookies().get(LANG_COOKIE)?.value);
export const getDict = (): Dict => getDictFor(getLang());
