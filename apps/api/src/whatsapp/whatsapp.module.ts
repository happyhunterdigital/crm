import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";

@Module({
	imports: [AgentModule],
	controllers: [WhatsappController],
	providers: [WhatsappService],
})
export class WhatsappModule {}
