import dns from "node:dns";

type LookupCallback = (err: NodeJS.ErrnoException | null, address: any, family?: number) => void;

/**
 * Windows veya kurumsal/MEB ağ ortamlarında işletim sisteminin getaddrinfo fonksiyonu (dns.lookup)
 * generativelanguage.googleapis.com gibi bazı harici servis alan adlarında ENOTFOUND verebilmektedir.
 * Buna karşın Node'un dahili c-ares motoru (dns.resolve4) DNS sunucusuna doğrudan sorgu atarak
 * IP adreslerini başarıyla elde eder.
 *
 * Bu fallback mekanizması:
 * 1. Önce standart dns.lookup çalıştırır (localhost, IP'ler ve yerel hostlar anında döner).
 * 2. Hata (ENOTFOUND vb.) durumunda dns.resolve4 ile IP çözümlemesini tamamlar.
 */
export function setupDnsFallback(): void {
  const originalLookup = dns.lookup.bind(dns);

  (dns as any).lookup = function (
    hostname: string,
    options: any,
    callback?: LookupCallback
  ) {
    let cb = callback;
    let opt = options;

    if (typeof opt === "function") {
      cb = opt;
      opt = {};
    }

    originalLookup(hostname, opt, (err: NodeJS.ErrnoException | null, address: any, family: any) => {
      if (!err && address) {
        return cb?.(null, address, family);
      }

      // getaddrinfo başarısız olduysa (ENOTFOUND vb.) doğrudan c-ares resolve4 ile dene
      dns.resolve4(hostname, (resErr, addresses) => {
        if (resErr || !addresses || addresses.length === 0) {
          return cb?.(err || resErr, address, family);
        }

        if (opt && opt.all) {
          return cb?.(
            null,
            addresses.map((ip) => ({ address: ip, family: 4 })) as any
          );
        }

        return cb?.(null, addresses[0], 4);
      });
    });
  };
}
