import { AccountService } from "../accounts.ts";
import { openDatabase, defaultDatabasePath } from "../db.ts";
import { memoryMailer } from "../mailer.ts";

/**
 * `npm run users` — o que existe no banco, em linguagem de gente. Só leitura, e sem senha nenhuma
 * (o banco guarda derivação, não senha). O `memoryMailer` entra porque o serviço pede um envio de
 * e-mail no construtor e aqui nada é enviado.
 */

const db = openDatabase();
const users = new AccountService(db, memoryMailer()).listUsers();

if (users.length === 0) {
  console.log(`Nenhuma conta ainda em ${defaultDatabasePath()}.`);
} else {
  console.log(`${users.length} conta(s) em ${defaultDatabasePath()}:\n`);
  console.table(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      nome: user.name,
      confirmado: user.verified ? "sim" : "NÃO",
      criada: new Date(user.createdAt).toLocaleString("pt-BR"),
      "último acesso": user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "—",
      save: user.hasSave ? new Date(user.saveUpdatedAt as string).toLocaleString("pt-BR") : "—",
    })),
  );
}
db.close();
