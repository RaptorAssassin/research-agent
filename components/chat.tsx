import { UserMessage, AssistantMessage } from "./message"

export function Chat() {
    return <div className="h-full flex flex-col items-center justify-start gap-2 w-full md:max-w-2/3 pt-8">
        <UserMessage message="Research task: What is the capital of France?" />
        <AssistantMessage message="I'm here to help you with your research. What would you like to know?" />
        <AssistantMessage message="The capital of France is Paris." />
        <UserMessage message="Lorem ipsum dolor, sit amet consectetur adipisicing elit. Dolor dignissimos nulla dicta! Molestiae repellat repudiandae nemo ab, dolor esse maxime, tempore similique soluta eligendi voluptatum a rem reprehenderit animi ullam!" />
        <AssistantMessage message="Bla Bla Bla test message" />
        {/* <AssistantMessage message="Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer" /> */}
    </div>
}


